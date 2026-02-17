"""
All AWS Resource Validators

Contains all validation functions for different AWS resource types.
This module contains the validation logic extracted from the main healthcheck.py file.
"""

from typing import Dict, List, Set
import boto3
from botocore.exceptions import ClientError

from utils.aws_helpers import (
    lambda_exists, alias_exists, layers_attached, lambda_role_correct, lambda_layer_exists,
    iam_role_exists, role_has_min_policies, managed_policy_valid, simulate_actions,
    alarm_exists, s3_bucket_exists, s3_policy_exists, kinesis_stream_exists,
    get_alias_target, key_is_enabled, get_lambda_policy, combine_results
)
from utils.logging_utils import info, debug
from utils.logging_utils import ok, warn, fail


def _verify_lambda_function_exists(physical_id: str, lmb_client, health_checks: List) -> str:
    """
    Verify that a Lambda function actually exists with the given physical ID.
    
    Args:
        physical_id: The physical resource ID from CloudFormation
        lmb_client: Boto3 Lambda client
        health_checks: List to append error results to
        
    Returns:
        physical_id if function exists, None if it doesn't exist or there's an error
    """
    try:
        lmb_client.get_function(FunctionName=physical_id)
        debug(f"Verified Lambda function exists: {physical_id}")
        return physical_id
    except ClientError as lambda_error:
        if lambda_error.response['Error']['Code'] == 'ResourceNotFoundException':
            warn(f"ProviderCreator Lambda function not found: {physical_id} (CloudFormation shows it exists but Lambda was likely deleted manually)")
            health_checks.append({
                "ResourceName": "ProviderCreator", 
                "status": 500, 
                "message": f"ERROR: ProviderCreator Lambda function not found: {physical_id} (CloudFormation stack shows resource exists but actual Lambda function is missing - likely deleted manually)"
            })
            return None
        else:
            warn(f"Error checking ProviderCreator Lambda function {physical_id}: {lambda_error}")
            health_checks.append({
                "ResourceName": "ProviderCreator", 
                "status": 500, 
                "message": f"ERROR: Cannot verify ProviderCreator Lambda function {physical_id}: {lambda_error}"
            })
            return None


def _get_connect_resource_for_role(role_name: str, actions: list, connect_storage: dict, health_input) -> str:
    """
    Get appropriate resource ARN for role simulation based on Connect configuration.
    
    For ImportXML and MultiOrg SKUs, Amazon Connect configured resources are the source of truth.
    This function maps roles to their appropriate resources discovered from Connect.
    
    Args:
        role_name: The IAM role name being validated
        actions: List of actions to simulate
        connect_storage: Discovered Connect storage configuration
        health_input: Health check input with SKU and Connect info
        
    Returns:
        Resource ARN to use for simulation, or "*" as fallback
    """
    if not connect_storage or not health_input:
        return "*"
    
    # Roles that need S3 bucket resources (for recordings, voicemail, transcripts)
    s3_roles = [
        "SCVS3Role", "SCVTenantBucketWriteAccessRole", 
        "VoiceMailAudioProcessingRole", "VoiceMailPackagingRole", "VoiceMailTranscribeRole",
        "ContactDataSyncFunctionRole", "PostCallAnalysisTriggerFunctionRole"
    ]
    
    # Roles that need CTR Kinesis stream resources
    ctr_stream_roles = ["CTRDataSyncFunctionRole"]
    
    # Roles that need Contact Lens stream resources
    contact_lens_roles = ["ContactLensConsumerFunctionRole"]
    
    # Check if any S3 actions are being simulated for S3-related roles
    has_s3_actions = any(act.startswith("s3:") for act in actions)
    if has_s3_actions and any(s3_role in role_name for s3_role in s3_roles):
        bucket = connect_storage.get('call_recordings_s3_bucket')
        if bucket:
            debug(f"Using Connect-discovered S3 bucket '{bucket}' for role '{role_name}'")
            return f"arn:aws:s3:::{bucket}/*"
    
    # Check if any Kinesis actions are being simulated for stream-related roles
    has_kinesis_actions = any(act.startswith("kinesis:") for act in actions)
    if has_kinesis_actions:
        if any(ctr_role in role_name for ctr_role in ctr_stream_roles):
            stream_arn = connect_storage.get('ctr_stream_arn')
            if stream_arn:
                debug(f"Using Connect-discovered CTR stream for role '{role_name}'")
                return stream_arn
        elif any(cl_role in role_name for cl_role in contact_lens_roles):
            stream_arn = connect_storage.get('contact_lens_stream_arn')
            if stream_arn:
                debug(f"Using Connect-discovered Contact Lens stream for role '{role_name}'")
                return stream_arn
    
    return "*"


def _verify_role_has_connect_bucket_in_policy(role_name: str, connect_bucket: str, cf_bucket_pattern: str, iam_client) -> tuple:
    """
    Verify that a role's policy includes the Connect-configured bucket.
    
    Only checks roles that have CloudFormation bucket pattern in their S3 resources.
    If a role has CF bucket pattern but NOT Connect bucket, it needs to be updated.
    
    Args:
        role_name: IAM role name to check
        connect_bucket: Connect-configured bucket name (source of truth)
        cf_bucket_pattern: CloudFormation bucket pattern (e.g., "lpimport-125176150299")
        iam_client: Boto3 IAM client
        
    Returns:
        tuple: (has_permission: bool, message: str, should_check: bool)
        - should_check=False means the role doesn't have CF bucket pattern, skip checking
    """
    try:
        has_cf_bucket_pattern = False
        has_connect_bucket = False
        cf_found_in = None
        connect_found_in = None
        
        def check_resources_in_statements(statements, policy_source):
            nonlocal has_cf_bucket_pattern, has_connect_bucket, cf_found_in, connect_found_in
            
            for statement in statements:
                if statement.get("Effect") != "Allow":
                    continue
                actions = statement.get("Action", [])
                if isinstance(actions, str):
                    actions = [actions]
                
                # Only check S3-related statements
                if not any(act.startswith("s3:") or act == "*" for act in actions):
                    continue
                    
                resources = statement.get("Resource", [])
                if isinstance(resources, str):
                    resources = [resources]
                    
                for resource in resources:
                    # Skip non-S3 resources
                    if not (resource == "*" or "s3:" in resource or resource.startswith("arn")):
                        continue
                    
                    # Check for CloudFormation bucket pattern
                    if cf_bucket_pattern and cf_bucket_pattern in resource:
                        has_cf_bucket_pattern = True
                        cf_found_in = policy_source
                        debug(f"Found CF bucket pattern '{cf_bucket_pattern}' in {policy_source}: {resource}")
                    
                    # Check for Connect bucket
                    if connect_bucket in resource:
                        has_connect_bucket = True
                        connect_found_in = policy_source
                        debug(f"Found Connect bucket '{connect_bucket}' in {policy_source}: {resource}")
                    
                    # Wildcard covers everything
                    if resource == "*" or resource == "arn:aws:s3:::*" or resource == "arn:*:s3:::*":
                        has_connect_bucket = True
                        connect_found_in = f"{policy_source} (wildcard)"
        
        # Check inline policies
        try:
            inline_policies = iam_client.list_role_policies(RoleName=role_name)
            for policy_name in inline_policies.get("PolicyNames", []):
                try:
                    policy_doc = iam_client.get_role_policy(RoleName=role_name, PolicyName=policy_name)
                    document = policy_doc.get("PolicyDocument", {})
                    check_resources_in_statements(document.get("Statement", []), f"inline:{policy_name}")
                except ClientError as e:
                    debug(f"Could not read inline policy {policy_name}: {e}")
        except ClientError as e:
            debug(f"Could not list inline policies for {role_name}: {e}")
        
        # Check attached policies
        try:
            attached_policies = iam_client.list_attached_role_policies(RoleName=role_name)
            for policy in attached_policies.get("AttachedPolicies", []):
                policy_arn = policy["PolicyArn"]
                try:
                    policy_details = iam_client.get_policy(PolicyArn=policy_arn)
                    version_id = policy_details["Policy"]["DefaultVersionId"]
                    policy_version = iam_client.get_policy_version(PolicyArn=policy_arn, VersionId=version_id)
                    document = policy_version.get("PolicyVersion", {}).get("Document", {})
                    check_resources_in_statements(document.get("Statement", []), f"attached:{policy['PolicyName']}")
                except ClientError as e:
                    debug(f"Could not read policy {policy_arn}: {e}")
        except ClientError as e:
            debug(f"Could not list attached policies for {role_name}: {e}")
        
        # If role doesn't have CF bucket pattern in S3 resources, skip checking
        if not has_cf_bucket_pattern:
            debug(f"Role '{role_name}' does not have CF bucket pattern '{cf_bucket_pattern}' in S3 resources - skipping Connect bucket check")
            return (True, f"Role '{role_name}' does not have S3 bucket resources with pattern '{cf_bucket_pattern}' - no check needed", False)
        
        # Role has CF bucket pattern - check if Connect bucket is also there
        if has_connect_bucket:
            return (True, f"Role '{role_name}' has Connect bucket '{connect_bucket}' in policy ({connect_found_in})", True)
        else:
            return (False, f"Role '{role_name}' has CF bucket '{cf_bucket_pattern}' but MISSING Connect bucket '{connect_bucket}' - customer needs to update role policy", True)
            
    except Exception as e:
        return (False, f"Could not verify bucket permission for role '{role_name}': {e}", True)


def validate_roles(cfg: Dict, health_input=None) -> Dict:
    """
    Validate IAM roles configuration.
    
    For ImportXML and MultiOrg SKUs, discovers actual resources from Amazon Connect
    and validates role permissions against those resources (source of truth).
    
    Args:
        cfg: Expected resources configuration
        health_input: Health check input containing SKU and Connect instance info
    """
    debug("Validating IAM Roles")
    
    # Get AWS account ID for simulations
    try:
        sts = boto3.client("sts")
        ACCOUNT_ID = sts.get_caller_identity()["Account"]
    except Exception:
        ACCOUNT_ID = "UNKNOWN"
    
    iam = boto3.client("iam")
    health_checks = []
    
    # For ImportXML and MultiOrg SKUs, discover Connect storage configuration once
    # Amazon Connect configured resources are the source of truth for these SKUs
    connect_storage = None
    if health_input and health_input.sku in ("multiorg", "importxml"):
        if health_input.connect_instance_id:
            try:
                from utils.stream_discovery import discover_connect_storage
                info(f"Discovering Connect storage for {health_input.sku.upper()} SKU (source of truth for resources)")
                connect_storage = discover_connect_storage(health_input.connect_instance_id, health_input.region)
                debug(f"Connect storage discovery result: {connect_storage}")
            except Exception as e:
                warn(f"Failed to discover Connect storage: {e}. Will use default resource validation.")
    
    for role_config in cfg.get("IAMRoles", []):
        # Import condition evaluator
        from utils.condition_evaluator import should_validate_resource, get_resolved_resource_name
        
        # Check if this resource should be validated based on its condition
        if not should_validate_resource(role_config):
            debug(f"Skipping IAM role {role_config.get('resource_name', 'unknown')} due to condition")
            continue
        
        # Get the resolved role name
        name = get_resolved_resource_name(role_config)
        debug(f"Validating IAM Role: {name}")
        
        exists, msg = iam_role_exists(name, iam)
        if not exists:
            health_checks.append({"ResourceName": name, "status": 500, "message": msg})
            continue
        
        results = []
        
        actions_to_simulate = role_config.get("simulate_actions")
        simulation_passed = True
        
        # First, check actual permissions via simulation (this is what really matters)
        if actions_to_simulate and ACCOUNT_ID != "UNKNOWN":
            debug(f"Simulating {len(actions_to_simulate)} action(s) for role '{name}'...")
            
            # Get appropriate resource ARN for simulation
            # For ImportXML/MultiOrg, use Connect-discovered resources as source of truth
            resource_arn = _get_connect_resource_for_role(name, actions_to_simulate, connect_storage, health_input)
            
            # For ImportXML/MultiOrg: Verify role policy includes Connect-configured bucket
            # Only check if role has CloudFormation bucket pattern in its S3 resources
            if connect_storage and health_input and health_input.sku in ("multiorg", "importxml"):
                has_s3_actions = any(act.startswith("s3:") for act in actions_to_simulate)
                if has_s3_actions:
                    connect_bucket = connect_storage.get('call_recordings_s3_bucket')
                    # Get CF bucket pattern from health_input (e.g., "lpimport-125176150299")
                    cf_bucket_pattern = health_input.s3_bucket_for_tenant_resources
                    if not cf_bucket_pattern and health_input.account_id:
                        # Try to construct from call center name
                        cf_bucket_pattern = f"{health_input.cc_name}-{health_input.account_id}" if health_input.cc_name else None
                    
                    if connect_bucket and cf_bucket_pattern:
                        bucket_check_result = _verify_role_has_connect_bucket_in_policy(
                            name, connect_bucket, cf_bucket_pattern, iam
                        )
                        success, message, should_check = bucket_check_result
                        if should_check:  # Only report if role has CF bucket pattern
                            if success:
                                debug(message)
                            else:
                                warn(message)
                                results.append((False, message))
            
            simulation_results = simulate_actions(
                role=name,
                actions=actions_to_simulate,
                iam_client=iam,
                account_id=ACCOUNT_ID,
                resource_arn=resource_arn
            )
            for success, message in simulation_results:
                if success:
                    ok(message)
                else:
                    fail(message)
                    simulation_passed = False
            # Add all simulation results to the list
            results.extend(simulation_results)

        # Check if role has minimum required policies attached
        # Only report as error if permissions simulation also failed
        # If permissions are there, missing policy name is just informational
        minimum_policies = role_config.get("minimum_policies", [])
        if minimum_policies:
            policies_ok, policy_msg = role_has_min_policies(name, minimum_policies, iam)
            if not policies_ok:
                if simulation_passed and actions_to_simulate:
                    # Permissions are fine, missing policy is just a warning
                    warn(f"Role '{name}' is missing expected policy names but has required permissions")
                    results.append((True, f"{policy_msg} (permissions verified via simulation)"))
                else:
                    # No simulation or simulation failed - report policy error
                    results.append((policies_ok, policy_msg))
            else:
                results.append((policies_ok, policy_msg))

        # Warn if no validations were performed (role exists but nothing was validated)
        if not results:
            warn(f"IAM role '{name}' exists but no policies or actions were configured for validation")
            results.append((True, "Role exists (no policies or actions configured for validation)"))
        
        # Combine all check results for this role into a single health check entry
        health_checks.append(combine_results(name, results))

    return {"ResourceType": "IAM Role", "DetailedHealthCheck": health_checks}


def validate_lambdas(cfg: Dict, health_input=None) -> Dict:
    """Validate Lambda functions configuration"""
    debug("Validating Lambda Functions")
    
    lmb = boto3.client("lambda")
    cf = boto3.client("cloudformation")
    health_checks = []
    
    for fn_config in cfg.get("LambdaFunctions", []):
        # Import condition evaluator
        from utils.condition_evaluator import should_validate_resource, get_resolved_resource_name
        
        # Check if this resource should be validated based on its condition
        if not should_validate_resource(fn_config):
            debug(f"Skipping Lambda function {fn_config.get('resource_name', 'unknown')} due to condition")
            continue
        
        # Get the resolved function name
        name = get_resolved_resource_name(fn_config)
        resource_name = fn_config.get("resource_name", "")
        
        # Special handling for ProviderCreator based on SKU and stack existence
        if resource_name == "ProviderCreator" and health_input:
            sku = getattr(health_input, 'sku', '').upper()
            debug(f"ProviderCreator validation - SKU: {sku}")
            
            # Skip ProviderCreator for multiorg deployments
            if sku == "MULTIORG" or sku == "IMPORTXML":
                debug("Skipping ProviderCreator validation for MULTIORG deployment")
                continue
            
            # For BYOA/BYOAC, check if SCVBYOATenantStack exists and contains ProviderCreator
            if sku in ["BYOA", "BYOAC"]:
                try:
                    # Tenant stacks are typically deployed in us-east-1
                    cf_tenant = boto3.client("cloudformation", region_name="us-east-1")
                    # Check if SCVBYOATenantStack exists
                    cf_tenant.describe_stacks(StackName="SCVBYOATenantStack")
                    
                    # Check if ProviderCreator exists in the stack
                    try:
                        resources = cf_tenant.describe_stack_resources(
                            StackName="SCVBYOATenantStack",
                            LogicalResourceId="ProviderCreator"
                        )
                        if resources.get("StackResources"):
                            # Get the physical ID (actual Lambda function name)
                            physical_id = resources["StackResources"][0]["PhysicalResourceId"]
                            debug(f"Found ProviderCreator in SCVBYOATenantStack with physical ID: {physical_id}")
                            
                            # Verify the Lambda function actually exists with this physical ID
                            # Use us-east-1 where tenant stack and ProviderCreator are deployed
                            lmb_tenant = boto3.client("lambda", region_name="us-east-1")
                            name = _verify_lambda_function_exists(physical_id, lmb_tenant, health_checks)
                            if not name:
                                continue
                            
                            # ProviderCreator validation is complete - add success result and skip normal validation
                            health_checks.append({
                                "ResourceName": "ProviderCreator",
                                "status": 200,
                                "message": f"SUCCESS: ProviderCreator Lambda function verified: {name}"
                            })
                            continue
                        else:
                            warn("ProviderCreator not found in SCVBYOATenantStack, skipping validation")
                            health_checks.append({
                                "ResourceName": "ProviderCreator", 
                                "status": 300, 
                                "message": "WARNING: ProviderCreator not found in SCVBYOATenantStack (may be expected for Provisioned BYOA deployments)"
                            })
                            continue
                    except ClientError as cf_error:
                        warn(f"CloudFormation error accessing ProviderCreator resource in SCVBYOATenantStack: {cf_error}")
                        health_checks.append({
                            "ResourceName": "ProviderCreator", 
                            "status": 300, 
                            "message": f"WARNING: CloudFormation error accessing ProviderCreator resource in SCVBYOATenantStack: {cf_error} (may be expected for Provisioned BYOA deployments)"
                        })
                        continue
                        
                except ClientError as stack_error:
                    info(f"CloudFormation error accessing SCVBYOATenantStack for BYOA/BYOAC deployment: {stack_error}")
                    health_checks.append({
                        "ResourceName": "ProviderCreator", 
                        "status": 200, 
                        "message": f"SUCCESS: CloudFormation error accessing SCVBYOATenantStack for BYOA/BYOAC deployment: {stack_error} (expected behavior - stack may not exist)"
                    })
                    continue
            
            # For RESELL, check SCVTenantStack
            elif sku == "RESELL":
                try:
                    # Tenant stacks are typically deployed in us-east-1
                    cf_tenant = boto3.client("cloudformation", region_name="us-east-1")
                    # Check if SCVTenantStack exists and contains ProviderCreator
                    resources = cf_tenant.describe_stack_resources(
                        StackName="SCVTenantStack",
                        LogicalResourceId="ProviderCreator"
                    )
                    if resources.get("StackResources"):
                        # Get the physical ID (actual Lambda function name)
                        physical_id = resources["StackResources"][0]["PhysicalResourceId"]
                        debug(f"Found ProviderCreator in SCVTenantStack with physical ID: {physical_id}")
                        
                        # Verify the Lambda function actually exists with this physical ID
                        # Use us-east-1 where tenant stack and ProviderCreator are deployed
                        lmb_tenant = boto3.client("lambda", region_name="us-east-1")
                        name = _verify_lambda_function_exists(physical_id, lmb_tenant, health_checks)
                        if not name:
                            continue
                        
                        # ProviderCreator validation is complete - add success result and skip normal validation
                        health_checks.append({
                            "ResourceName": "ProviderCreator",
                            "status": 200,
                            "message": f"SUCCESS: ProviderCreator Lambda function verified: {name}"
                        })
                        continue
                    else:
                        info("ProviderCreator not found in SCVTenantStack, skipping validation")
                        health_checks.append({
                            "ResourceName": "ProviderCreator", 
                            "status": 200, 
                            "message": "SUCCESS: ProviderCreator not found in SCVTenantStack (expected for some RESELL deployments)"
                        })
                        continue
                except ClientError as cf_error:
                    info(f"CloudFormation error accessing SCVTenantStack or ProviderCreator resource: {cf_error}")
                    health_checks.append({
                        "ResourceName": "ProviderCreator", 
                        "status": 200, 
                        "message": f"SUCCESS: CloudFormation error accessing SCVTenantStack or ProviderCreator resource: {cf_error} (expected behavior - stack or resource may not exist)"
                    })
                    continue
        
        debug(f"Validating Lambda Function: {name}")
        
        exists, msg = lambda_exists(name, lmb)
        if not exists:
            health_checks.append({"ResourceName": name, "status": 500, "message": msg})
            continue

        results = []
        
        # Only check alias if it exists in the JSON blueprint
        if "alias" in fn_config:
            results.append(alias_exists(name, fn_config["alias"], lmb))
        
        results.extend([
            layers_attached(name, fn_config.get("layers", []), lmb),
            lambda_role_correct(name, fn_config.get("execution_role"), lmb,
                               fn_config.get("triggers", []), cfg, health_input)
        ])
        health_checks.append(combine_results(name, results))
            
    return {"ResourceType": "Lambda Function", "DetailedHealthCheck": health_checks}


def validate_layers(cfg: Dict) -> Dict:
    """Validate Lambda layers configuration"""
    debug("Validating Lambda Layers")
    
    lmb = boto3.client("lambda")
    health_checks = []
    
    for layer_config in cfg.get("LambdaLayers", []):
        name = layer_config["name"]
        debug(f"Validating Lambda Layer: {name}")
        is_healthy, msg = lambda_layer_exists(name, lmb)
        health_checks.append(combine_results(name, [(is_healthy, msg)]))
        
    return {"ResourceType": "Lambda Layer", "DetailedHealthCheck": health_checks}


def validate_policies(cfg: Dict) -> Dict:
    """Validate IAM managed policies configuration"""
    debug("Validating IAM Managed Policies")
    
    iam = boto3.client("iam")
    health_checks = []
    
    for pol_config in cfg.get("ManagedPolicies", []):
        name = pol_config.get("name", "").strip()
        resource_name = pol_config.get("resource_name", "").strip()
        
        # Use resource_name as display name when policy name is empty
        display_name = name if name else resource_name
        
        if not name:
            debug(f"Managed Policy '{resource_name}' has empty name - configuration may need updating")
            health_checks.append(combine_results(display_name, [(False, f"Configuration issue: Policy name is empty for '{resource_name}' - check if policy exists or config needs updating")]))
            continue
            
        debug(f"Validating Managed Policy: {name}")
        is_healthy, msg = managed_policy_valid(name, pol_config.get("expected_actions", []), iam)
        health_checks.append(combine_results(name, [(is_healthy, msg)]))
        
    return {"ResourceType": "IAM Managed Policy", "DetailedHealthCheck": health_checks}


def validate_alarms(cfg: Dict) -> Dict:
    """Validate CloudWatch alarms configuration"""
    debug("Validating CloudWatch Alarms")
    
    cloudwatch = boto3.client("cloudwatch")
    health_checks = []
    
    for alarm_config in cfg.get("CloudWatchAlarms", []):
        name = alarm_config["name"]
        debug(f"Validating CloudWatch Alarm: {name}")
        
        alarm_details, msg = alarm_exists(name, cloudwatch)
        if not alarm_details:
            health_checks.append({"ResourceName": name, "status": 500, "message": msg})
        else:
            state = alarm_details.get("StateValue")
            if state in ("OK", "INSUFFICIENT_DATA"):
                ok(f"Alarm state healthy ({state}): {name}")
                health_checks.append({"ResourceName": name, "status": 200, "message": "healthy"})
            else:
                msg = f"Alarm in ALARM state: {name}"
                fail(msg)
                health_checks.append({"ResourceName": name, "status": 500, "message": msg})

    return {"ResourceType": "CloudWatch Alarm", "DetailedHealthCheck": health_checks}


def validate_s3(cfg: Dict, health_input=None) -> Dict:
    """
    Validate S3 buckets configuration.
    
    This function validates that:
    1. All S3 buckets exist and are accessible
    2. For the specific 'S3Bucket' resource, additionally verifies it matches the bucket configured in Amazon Connect
    3. For ImportXML/MultiOrg: Connect-configured bucket is the source of truth
    4. Other S3 buckets (CloudTrail, etc.) get standard validation only
    """
    debug("Validating S3 Buckets")
    
    s3 = boto3.client("s3")
    health_checks = []
    
    # Check if this is ImportXML/MultiOrg where Connect is source of truth
    is_connect_source_of_truth = (
        health_input and 
        hasattr(health_input, 'sku') and 
        health_input.sku in ("multiorg", "importxml")
    )
    
    for bucket_config in cfg.get("S3Buckets", []):
        # Import condition evaluator
        from utils.condition_evaluator import should_validate_resource, get_resolved_resource_name
        
        # Debug: Log the bucket config
        import json
        debug(f"Processing S3 bucket config: {json.dumps(bucket_config, indent=2)}")
        
        # Check if this resource should be validated based on its condition
        if not should_validate_resource(bucket_config):
            debug(f"Skipping S3 bucket {bucket_config.get('resource_name', 'unknown')} due to condition")
            continue
        
        # Get the resolved bucket name
        name = get_resolved_resource_name(bucket_config)
        resource_name = bucket_config.get('resource_name', 'unknown')
        
        debug(f"Resolved S3 bucket name: '{name}' for resource '{resource_name}'")
        debug(f"Validating S3 Bucket: {name}")
        
        results = []
        
        # For S3Bucket resource: Check Connect configuration FIRST for ImportXML/MultiOrg
        if resource_name == "S3Bucket":
            # Discover Connect S3 storage on-demand
            connect_storage = None
            if health_input and getattr(health_input, 'connect_instance_id', None):
                try:
                    from utils.stream_discovery import discover_connect_s3_storage
                    connect_storage = discover_connect_s3_storage(health_input.connect_instance_id)
                    debug(f"Connect S3 storage discovery completed for S3Bucket verification")
                except Exception as e:
                    debug(f"Connect S3 storage discovery failed: {e}")
            
            if connect_storage:
                debug(f"Applying Connect verification for S3Bucket resource: {name}")
                connect_verification_result = _verify_s3_bucket_matches_connect(
                    name, connect_storage, health_input
                )
                results.append(connect_verification_result)
                
                if connect_verification_result[0]:  # Verification passed
                    # For ImportXML/MultiOrg, we validated the Connect bucket, skip CF bucket check
                    if is_connect_source_of_truth:
                        connect_bucket = connect_storage.get('call_recordings_s3_bucket')
                        if connect_bucket and connect_bucket != name:
                            # Use Connect bucket name for reporting
                            health_checks.append(combine_results(connect_bucket, results))
                            continue
                else:  # Verification failed
                    health_checks.append({
                        "ResourceName": resource_name,
                        "status": 500, 
                        "message": connect_verification_result[1]
                    })
                    continue
            else:
                debug(f"Skipping Connect verification for S3Bucket '{name}' - no Connect storage available")
        
        # Basic existence check for expected bucket
        # For ImportXML/MultiOrg S3Bucket: Skip if we already validated Connect bucket above
        exists, msg = s3_bucket_exists(name, s3)
        if not exists:
            # For ImportXML/MultiOrg S3Bucket: This is OK if Connect bucket was validated
            if is_connect_source_of_truth and resource_name == "S3Bucket" and results:
                debug(f"Expected bucket '{name}' doesn't exist, but Connect bucket was validated - this is OK for {health_input.sku.upper()}")
                # Results already added above, continue to next bucket
                health_checks.append(combine_results(name, results))
                continue
            health_checks.append({"ResourceName": name, "status": 500, "message": msg})
            continue

        # Standard policy validation
        if bucket_config.get("policy"):
            results.append(s3_policy_exists(name, s3))
        
        health_checks.append(combine_results(name, results))

    return {"ResourceType": "S3 Bucket", "DetailedHealthCheck": health_checks}


def _verify_s3_bucket_matches_connect(bucket_name: str, connect_storage: Dict, health_input) -> tuple:
    """
    Verify that the resolved S3 bucket name matches what's configured in Amazon Connect.
    
    For ImportXML/MultiOrg SKUs: Connect-configured bucket is the source of truth.
    The expected bucket may differ from Connect - this is expected because
    customers may have pre-configured a custom bucket in Connect.
    
    Args:
        bucket_name: The resolved S3 bucket name being validated
        connect_storage: Dict of discovered Connect storage configurations
        health_input: Health check input containing environment info
        
    Returns:
        tuple: (success: bool, message: str)
    """
    try:
        # Get Connect configured bucket for call recordings
        call_recordings_bucket = connect_storage.get('call_recordings_s3_bucket')
        
        debug(f"Health check bucket: '{bucket_name}'")
        debug(f"Connect call recordings bucket: '{call_recordings_bucket}'")
        
        # For ImportXML/MultiOrg: Connect is source of truth
        # Customer may have pre-configured a custom bucket - that's expected
        is_connect_source_of_truth = (
            health_input and 
            hasattr(health_input, 'sku') and 
            health_input.sku in ("multiorg", "importxml")
        )
        
        if not call_recordings_bucket:
            error_msg = "No call recordings bucket configured in Connect"
            debug(f"❌ {error_msg}")
            return (False, error_msg)
        
        if bucket_name == call_recordings_bucket:
            debug(f"✅ Bucket matches Connect call recordings configuration")
            return (True, "S3 bucket matches Connect call recordings configuration")
        
        # Buckets don't match - behavior depends on SKU
        if is_connect_source_of_truth:
            # For ImportXML/MultiOrg: This is OK - Connect bucket is what matters
            # Verify the Connect-configured bucket exists
            s3 = boto3.client("s3")
            try:
                s3.head_bucket(Bucket=call_recordings_bucket)
                info_msg = (f"Connect-configured bucket '{call_recordings_bucket}' is the source of truth "
                           f"(differs from expected bucket '{bucket_name}' - this is expected for {health_input.sku.upper()})")
                debug(f"✅ {info_msg}")
                ok(info_msg)
                return (True, info_msg)
            except ClientError as e:
                error_code = e.response.get('Error', {}).get('Code', '')
                if error_code == '404':
                    error_msg = f"Connect-configured bucket '{call_recordings_bucket}' does not exist"
                elif error_code == '403':
                    error_msg = f"No access to Connect-configured bucket '{call_recordings_bucket}'"
                else:
                    error_msg = f"Cannot verify Connect-configured bucket '{call_recordings_bucket}': {e}"
                debug(f"❌ {error_msg}")
                return (False, error_msg)
        else:
            # For other SKUs: Mismatch is an error
            error_msg = f"Call recordings bucket mismatch: expected '{bucket_name}', got '{call_recordings_bucket}'"
            debug(f"❌ {error_msg}")
            return (False, error_msg)
            
    except Exception as e:
        error_msg = f"S3 bucket Connect verification failed: {str(e)}"
        debug(error_msg)
        return (False, error_msg)


def validate_kinesis(cfg: Dict) -> Dict:
    """Validate Kinesis streams configuration"""
    debug("Validating Kinesis Streams")
    
    kinesis = boto3.client("kinesis")
    health_checks = []
    
    try:
        all_streams = {s for p in kinesis.get_paginator("list_streams").paginate() for s in p.get("StreamNames", [])}
        for stream_config in cfg.get("KinesisStreams", []):
            name = stream_config["name"]
            debug(f"Validating Kinesis Stream: {name}")
            is_healthy, msg = kinesis_stream_exists(name, all_streams)
            health_checks.append(combine_results(name, [(is_healthy, msg)]))
    except ClientError as e:
        fail(f"Could not list Kinesis streams: {e}")
        health_checks.append({"ResourceName": "All Kinesis Streams", "status": 500, "message": f"Could not list Kinesis streams: {e}"})

    return {"ResourceType": "Kinesis Stream", "DetailedHealthCheck": health_checks}


def validate_kms_aliases(cfg: Dict) -> Dict:
    """Validate KMS aliases configuration"""
    debug("Validating KMS Aliases")
    
    kms = boto3.client("kms")
    health_checks = []
    
    for alias_config in cfg.get("KMSAliases", []):
        name = alias_config["name"]
        debug(f"Validating KMS Alias: {name}")
        
        target_key_id, msg = get_alias_target(name, kms)
        if not target_key_id:
            health_checks.append({"ResourceName": name, "status": 500, "message": msg})
            continue

        is_enabled, enabled_msg = key_is_enabled(target_key_id, kms)
        health_checks.append(combine_results(name, [(is_enabled, enabled_msg)]))
        
    return {"ResourceType": "KMS Alias", "DetailedHealthCheck": health_checks}




def validate_triggers_by_lambda_policy(cfg: Dict, all_lambda_names: Set[str]) -> Dict:
    """Validate EventBridge rules by checking Lambda policies"""
    debug("Validating EventBridge Rules")
    
    events = boto3.client("events")
    lmb = boto3.client("lambda")
    health_checks = []
    
    for rule_config in cfg.get("EventBridgeRules", []):
        name = rule_config["name"]
        debug(f"Validating EventBridge Rule: {name}")
        
        targets = rule_config.get("targets", [])
        if not targets:
            warn(f"Rule '{name}' has no targets defined.")
            health_checks.append(combine_results(name, [(False, "Rule has no targets defined in expected config.")]))
            continue
            
        target_lambda_name = targets[0]
        policy = get_lambda_policy(target_lambda_name, lmb)
        
        if not policy:
            msg = f"No resource policy found for target Lambda '{target_lambda_name}'"
            fail(msg)
            health_checks.append(combine_results(name, [(False, msg)]))
            continue

        rule_arn = next((stmt.get("Condition", {}).get("ArnLike", {}).get("AWS:SourceArn") for stmt in policy.get("Statement", []) if stmt.get("Principal", {}).get("Service") == "events.amazonaws.com"), None)
        if not rule_arn:
            msg = f"No EventBridge trigger found in policy for Lambda '{target_lambda_name}'"
            fail(msg)
            health_checks.append(combine_results(name, [(False, msg)]))
            continue
        
        actual_rule_name = rule_arn.split('/')[-1]
        ok(f"Found trigger via Lambda policy: rule '{actual_rule_name}'")
        
        try:
            rule_details = events.describe_rule(Name=actual_rule_name)
            if rule_details.get("State") == "ENABLED":
                health_checks.append(combine_results(actual_rule_name, [(True, "healthy")]))
            else:
                msg = f"Rule '{actual_rule_name}' is not ENABLED (State: {rule_details.get('State')})"
                fail(msg)
                health_checks.append(combine_results(actual_rule_name, [(False, msg)]))
        except ClientError as e:
            msg = f"Could not describe the found rule '{actual_rule_name}': {e}"
            fail(msg)
            health_checks.append(combine_results(name, [(False, msg)]))
            
    return {"ResourceType": "EventBridge Rule", "DetailedHealthCheck": health_checks}


def validate_event_source_mappings(cfg: Dict, all_lambda_names: Set[str]) -> Dict:
    """Validate Lambda event source mappings"""
    debug("Validating Event Source Mappings")
    
    lmb = boto3.client("lambda")
    health_checks = []
    
    for mapping_config in cfg.get("EventSourceMappings", []):
        # Import condition evaluator
        from utils.condition_evaluator import should_validate_resource
        
        # Check if this resource should be validated based on its condition
        if not should_validate_resource(mapping_config):
            debug(f"Skipping EventSourceMapping {mapping_config.get('resource_name', 'unknown')} due to condition")
            continue
        
        name = mapping_config["name"]
        expected_fn_ref, expected_source = mapping_config["function"], mapping_config.get("event_source")
        debug(f"Validating Event Source Mapping: {name}")
        
        if not expected_source:
            warn(f"Skipping mapping for '{name}' because 'event_source' is not defined.")
            health_checks.append(combine_results(name, [(False, "event_source not defined in config")]))
            continue
        
        # Handle complex event sources (CloudFormation !If statements)
        resolved_source = _resolve_event_source(expected_source)
        if not resolved_source:
            # Try pattern-based validation as fallback
            resolved_source = _fallback_event_source_validation(expected_source, name)
            if not resolved_source:
                # Skip validation if event source cannot be resolved (e.g., stream discovery fails)
                # This is expected in environments without AWS Connect access
                debug(f"Skipping EventSourceMapping '{name}' - event_source could not be resolved: {expected_source}")
                continue
            
        actual_fn_name = next((n for n in all_lambda_names if expected_fn_ref in n), None)
        if not actual_fn_name:
            msg = f"Could not find deployed Lambda for reference '{expected_fn_ref}'"
            fail(msg)
            health_checks.append(combine_results(name, [(False, msg)]))
            continue
            
        try:
            mappings = lmb.list_event_source_mappings(FunctionName=actual_fn_name).get("EventSourceMappings", [])
            found = next((m for m in mappings if resolved_source in m.get("EventSourceArn", "")), None)
            if found:
                ok(f"Mapping found for source '{resolved_source}'")
                if found.get("State") == "Enabled":
                    health_checks.append(combine_results(name, [(True, "healthy")]))
                else:
                    msg = f"Mapping is not Enabled (State: {found['State']})"
                    fail(msg)
                    health_checks.append(combine_results(name, [(False, msg)]))
            else:
                # Check if this is a conditional EventSourceMapping that might not exist
                if _is_conditional_event_source_mapping(mapping_config, expected_source):
                    debug(f"Conditional EventSourceMapping '{name}' not found - this may be expected based on configuration")
                    # Don't add to health_checks - skip silently as this might be expected
                else:
                    msg = f"No mapping found for function '{actual_fn_name}' with source like '{resolved_source}'"
                    fail(msg)
                    health_checks.append(combine_results(name, [(False, msg)]))
        except ClientError as e:
            msg = f"API Error validating event source mapping for {actual_fn_name}: {e}"
            warn(msg)
            health_checks.append(combine_results(name, [(False, msg)]))

    return {"ResourceType": "Event Source Mapping", "DetailedHealthCheck": health_checks}


def validate_lambda_permissions(cfg: Dict, all_lambda_names: Set[str]) -> Dict:
    """Validate Lambda function permissions"""
    debug("Validating Lambda Permissions")
    
    lmb = boto3.client("lambda")
    health_checks = []
    
    for perm_config in cfg.get("LambdaPermissions", []):
        name = perm_config["name"]
        expected_fn_ref, expected_principal, expected_source = perm_config["function"], perm_config["principal"], perm_config["source"]
        debug(f"Validating Lambda Permission: {name}")
        
        actual_fn_name = next((n for n in all_lambda_names if expected_fn_ref in n), None)
        if not actual_fn_name:
            msg = f"Could not find a unique deployed Lambda for reference '{expected_fn_ref}'"
            fail(msg)
            health_checks.append(combine_results(name, [(False, msg)]))
            continue
            
        policy = get_lambda_policy(actual_fn_name, lmb)
        if not policy:
            msg = f"No resource policy found for Lambda '{actual_fn_name}'"
            fail(msg)
            health_checks.append(combine_results(name, [(False, msg)]))
            continue

        found = any(s.get("Principal", {}).get("Service") == expected_principal and expected_source in s.get("Condition", {}).get("ArnLike", {}).get("AWS:SourceArn", "") for s in policy.get("Statement", []))
        if found:
            ok(f"Permission found for principal '{expected_principal}' on '{actual_fn_name}'")
            health_checks.append(combine_results(name, [(True, "healthy")]))
        else:
            msg = f"Permission NOT found for principal '{expected_principal}' and source matching '{expected_source}'"
            fail(msg)
            health_checks.append(combine_results(name, [(False, msg)]))
            
    return {"ResourceType": "Lambda Permission", "DetailedHealthCheck": health_checks}


def _resolve_event_source(event_source: str) -> str:
    """
    Resolve complex event sources including CloudFormation !If statements.
    
    Args:
        event_source: The event source from the config (may contain CloudFormation intrinsics)
        
    Returns:
        Resolved event source ARN or None if it cannot be resolved
    """
    import os
    
    # If it's a simple ARN or stream name, return as-is
    if not isinstance(event_source, str) or not ("{'If'" in event_source or "If" in event_source):
        return event_source
    
    # Handle CloudFormation !If statements for stream ARNs
    if "DoCreateCTRStream" in event_source:
        # This is a conditional CTR stream
        # For now, we always use SCV-managed streams (discovered dynamically)
        # In the future, customer-configured stream logic can be added here
        return _discover_stream_arn(event_source, "CTR")
    
    elif "DoCreateCLStream" in event_source or "ContactLens" in event_source:
        # This is a conditional Contact Lens stream
        # For now, we always use SCV-managed streams (discovered dynamically)
        # In the future, customer-configured stream logic can be added here
        return _discover_stream_arn(event_source, "CL")
    
    # Could not resolve - this is expected when stream discovery fails
    # Return None to indicate the validation should be skipped
    debug(f"Could not resolve complex event source (stream discovery may have failed): {event_source}")
    return None


def _fallback_event_source_validation(event_source: str, mapping_name: str) -> str:
    """
    Fallback validation for event sources using actual stream discovery.
    
    Uses the existing stream discovery function to find actual stream ARNs
    instead of hardcoded patterns.
    
    Args:
        event_source: The complex event source that couldn't be resolved
        mapping_name: The name of the event source mapping
        
    Returns:
        Actual stream ARN from Connect discovery, or None if not found
    """
    import os
    
    connect_instance_id = os.environ.get("CONNECT_INSTANCE_ID")
    if not connect_instance_id:
        debug("No CONNECT_INSTANCE_ID available for stream discovery fallback")
        return None
    
    try:
        from utils.stream_discovery import discover_connect_streams
        
        # Discover actual streams from Connect instance
        debug(f"Attempting stream discovery fallback for instance: {connect_instance_id}")
        discovered = discover_connect_streams(connect_instance_id)
        
        # For CTR streams
        if "DoCreateCTRStream" in event_source:
            ctr_stream_arn = discovered.get('ctr_stream_arn')
            if ctr_stream_arn:
                debug(f"Fallback discovered CTR stream: {ctr_stream_arn}")
                return ctr_stream_arn
            else:
                debug("No CTR stream found in Connect instance")
        
        # For Contact Lens streams  
        elif "DoCreateCLStream" in event_source or "ContactLens" in event_source:
            cl_stream_arn = discovered.get('contact_lens_stream_arn')
            if cl_stream_arn:
                debug(f"Fallback discovered CL stream: {cl_stream_arn}")
                return cl_stream_arn
            else:
                debug("No Contact Lens stream found in Connect instance")
        
    except Exception as e:
        debug(f"Stream discovery fallback failed: {e}")
    
    # No stream discovered
    debug(f"No stream discovered for event source: {event_source}")
    return None


def _discover_stream_arn(event_source: str, stream_type: str) -> str:
    """
    Discover actual stream ARN from AWS Connect instance.
    
    Args:
        event_source: The event source containing the condition
        stream_type: "CTR" or "CL" to specify which stream to discover
        
    Returns:
        Discovered stream ARN or None if not found
    """
    import os
    
    connect_instance_id = os.environ.get("CONNECT_INSTANCE_ID")
    if not connect_instance_id:
        debug("No CONNECT_INSTANCE_ID available for stream discovery")
        return None
    
    try:
        from utils.stream_discovery import discover_connect_streams
        discovered = discover_connect_streams(connect_instance_id)
        
        if stream_type == "CTR":
            stream_arn = discovered.get('ctr_stream_arn')
            stream_name = "CTR"
        elif stream_type == "CL":
            stream_arn = discovered.get('contact_lens_stream_arn')
            stream_name = "Contact Lens"
        else:
            debug(f"Unknown stream type: {stream_type}")
            return None
        
        if stream_arn:
            debug(f"Discovered SCV-managed {stream_name} stream: {stream_arn}")
            return stream_arn
        else:
            debug(f"No {stream_name} stream discovered for instance {connect_instance_id}")
            
    except Exception as e:
        debug(f"{stream_type} stream discovery failed: {e}")
    
    return None


def _is_conditional_event_source_mapping(mapping_config: Dict, event_source: str) -> bool:
    """
    Check if an EventSourceMapping is conditional and might not exist.
    
    Args:
        mapping_config: The EventSourceMapping configuration
        event_source: The event source (may contain CloudFormation conditions)
        
    Returns:
        bool: True if this is a conditional mapping that might not exist
    """
    # Check if the event source contains CloudFormation conditions
    if isinstance(event_source, str) and ("{'If'" in event_source or "If" in event_source):
        # This is a conditional EventSourceMapping
        resource_name = mapping_config.get("resource_name", "")
        
        # Stream-related EventSourceMappings are often conditional
        if "Stream" in resource_name and ("DoCreate" in event_source):
            debug(f"Detected conditional stream EventSourceMapping: {resource_name}")
            return True
    
    return False

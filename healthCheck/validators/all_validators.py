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
    iam_role_exists, managed_policy_valid, simulate_actions,
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


def validate_roles(cfg: Dict) -> Dict:
    """Validate IAM roles configuration"""
    debug("Validating IAM Roles")
    
    # Get AWS account ID for simulations
    try:
        sts = boto3.client("sts")
        ACCOUNT_ID = sts.get_caller_identity()["Account"]
    except Exception:
        ACCOUNT_ID = "UNKNOWN"
    
    iam = boto3.client("iam")
    health_checks = []
    
    for role_config in cfg.get("IAMRoles", []):
        name = role_config["name"]
        debug(f"Validating IAM Role: {name}")
        
        exists, msg = iam_role_exists(name, iam)
        if not exists:
            health_checks.append({"ResourceName": name, "status": 500, "message": msg})
            continue
        
        results = []

        # policies_ok, policy_msg = role_has_min_policies(name, role_config.get("minimum_policies", []), iam)
        # results.append((policies_ok, policy_msg))
        actions_to_simulate = role_config.get("simulate_actions")
        if actions_to_simulate and ACCOUNT_ID != "UNKNOWN":
            debug(f"Simulating {len(actions_to_simulate)} action(s) for role '{name}'...")
            simulation_results = simulate_actions(
                role=name,
                actions=actions_to_simulate,
                iam_client=iam,
                account_id=ACCOUNT_ID
            )
            for success, message in simulation_results:
                if success:
                    ok(message)
                else:
                    fail(message)
            # Add all simulation results to the list
            results.extend(simulation_results)

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
        name = fn_config["name"]
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
            lambda_role_correct(name, fn_config.get("execution_role"), lmb)
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


def validate_s3(cfg: Dict) -> Dict:
    """Validate S3 buckets configuration"""
    debug("Validating S3 Buckets")
    
    s3 = boto3.client("s3")
    health_checks = []
    
    for bucket_config in cfg.get("S3Buckets", []):
        name = bucket_config["name"]
        debug(f"Validating S3 Bucket: {name}")
        
        exists, msg = s3_bucket_exists(name, s3)
        if not exists:
            health_checks.append({"ResourceName": name, "status": 500, "message": msg})
            continue

        results = []
        if bucket_config.get("policy"):
            results.append(s3_policy_exists(name, s3))
        
        health_checks.append(combine_results(name, results))

    return {"ResourceType": "S3 Bucket", "DetailedHealthCheck": health_checks}


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
        name = mapping_config["name"]
        expected_fn_ref, expected_source = mapping_config["function"], mapping_config.get("event_source")
        debug(f"Validating Event Source Mapping: {name}")
        
        if not expected_source:
            warn(f"Skipping mapping for '{name}' because 'event_source' is not defined.")
            health_checks.append(combine_results(name, [(False, "event_source not defined in config")]))
            continue
            
        actual_fn_name = next((n for n in all_lambda_names if expected_fn_ref in n), None)
        if not actual_fn_name:
            msg = f"Could not find deployed Lambda for reference '{expected_fn_ref}'"
            fail(msg)
            health_checks.append(combine_results(name, [(False, msg)]))
            continue
            
        try:
            mappings = lmb.list_event_source_mappings(FunctionName=actual_fn_name).get("EventSourceMappings", [])
            found = next((m for m in mappings if expected_source in m.get("EventSourceArn", "")), None)
            if found:
                ok(f"Mapping found for source '{expected_source}'")
                if found.get("State") == "Enabled":
                    health_checks.append(combine_results(name, [(True, "healthy")]))
                else:
                    msg = f"Mapping is not Enabled (State: {found['State']})"
                    fail(msg)
                    health_checks.append(combine_results(name, [(False, msg)]))
            else:
                msg = f"No mapping found for function '{actual_fn_name}' with source like '{expected_source}'"
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
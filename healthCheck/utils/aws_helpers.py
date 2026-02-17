"""
AWS helper functions for resource validation

Provides utility functions for checking AWS resources like Lambda functions,
IAM roles, S3 buckets, CloudWatch alarms, etc.
"""

import json
import re
from typing import Any, Dict, List, Optional, Tuple

from botocore.exceptions import ClientError
from utils.logging_utils import ok, warn, fail


# Regex pattern helper for wildcard matching
def _wildcard_to_regex(pattern: str) -> re.Pattern:
    """Convert a wildcard pattern (with *) to a compiled regex pattern."""
    escaped = re.escape(pattern).replace(r"\*", ".*")
    return re.compile(f'^{escaped}$', re.IGNORECASE)


# Lambda Helper Functions

def lambda_exists(name: str, lmb_client: Any) -> Tuple[bool, str]:
    """Check if a Lambda function exists"""
    try:
        lmb_client.get_function(FunctionName=name)
        ok(f"Lambda exists: {name}")
        return True, "healthy"
    except ClientError as e:
        code = e.response["Error"]["Code"]
        msg = f"Lambda {'missing' if code == 'ResourceNotFoundException' else 'error'}: {name} ({code})"
        fail(msg)
        return False, msg


def alias_exists(name: str, alias: str, lmb_client: Any) -> Tuple[bool, str]:
    """Check if a Lambda function alias exists"""
    try:
        lmb_client.get_alias(FunctionName=name, Name=alias)
        msg = f"Alias '{alias}' exists for {name}"
        ok(msg)
        return True, "Alias exists."
    except ClientError as e:
        code = e.response["Error"]["Code"]
        msg = f"Alias '{alias}' {'missing' if code == 'ResourceNotFoundException' else 'error'} for {name} ({code})"
        fail(msg)
        return False, msg


def layers_attached(name: str, expected: List[str], lmb_client: Any, alias: Optional[str] = None) -> Tuple[bool, str]:
    """Check if expected layers are attached to a Lambda function"""
    if not expected:
        return True, "No layers expected."
    try:
        qualifier_args = {"Qualifier": alias} if alias else {}
        cfg = lmb_client.get_function_configuration(FunctionName=name, **qualifier_args)
        arns = [layer["Arn"] for layer in cfg.get("Layers", [])]
        missing_layers = [layer_name for layer_name in expected if not any(layer_name in arn for arn in arns)]
        if not missing_layers:
            ok(f"All {len(expected)} expected layers attached to {name}.")
            return True, "All expected layers are attached."
        else:
            msg = f"Layers missing from {name}: {', '.join(missing_layers)}"
            fail(msg)
            return False, msg
    except ClientError as e:
        msg = f"Error retrieving layers for {name}: {e}"
        warn(msg)
        return False, msg


def lambda_role_correct(name: str, expected_role: str, lmb_client: Any,
                        triggers: List = None, cfg: Dict = None,
                        health_input = None) -> Tuple[bool, str]:
    """
    Check if Lambda function has the correct execution role and permissions.
    
    Args:
        name: Lambda function name
        expected_role: Expected execution role ARN or name
        lmb_client: Boto3 Lambda client
        triggers: List of trigger names (EventSourceMappings) for this Lambda
        cfg: Full config with EventSourceMappings, KinesisStreams, S3Buckets
        health_input: Health check input with SKU, account_id, region, connect info
    
    Returns:
        Tuple of (success, message)
    """
    if not expected_role:
        return True, "No execution role expected."
    try:
        fn_cfg = lmb_client.get_function(FunctionName=name)["Configuration"]
        actual_role_name = fn_cfg["Role"].split("/")[-1]
        # FIX: Also get just the name from the expected role to handle both ARNs and names
        expected_role_name = expected_role.split("/")[-1]
        
        if actual_role_name != expected_role_name:
            msg = f"Role mismatch for {name}: expected '{expected_role_name}', found '{actual_role_name}'"
            fail(msg)
            return False, msg
        
        ok(f"Role '{expected_role_name}' attached correctly to {name}.")
        
        # If triggers and config provided, also verify role has permissions on trigger resources
        if triggers and cfg:
            import boto3
            iam = boto3.client("iam")
            sts = boto3.client("sts")
            account_id = sts.get_caller_identity()["Account"]
            
            # Get Connect-configured resources for ImportXML/MultiOrg
            connect_storage = None
            if health_input and getattr(health_input, 'sku', '') in ('multiorg', 'importxml'):
                if getattr(health_input, 'connect_instance_id', None):
                    try:
                        from utils.stream_discovery import discover_connect_storage
                        connect_storage = discover_connect_storage(health_input.connect_instance_id)
                    except Exception:
                        pass
            
            permission_errors = []
            for trigger in triggers:
                resource_arn, actions = resolve_trigger_to_resource(trigger, cfg, health_input, connect_storage)
                if resource_arn and actions:
                    # Simulate permissions
                    results = simulate_actions(actual_role_name, actions, iam, account_id, resource_arn)
                    for success, message in results:
                        if not success:
                            permission_errors.append(f"{trigger}: {message}")
            
            if permission_errors:
                error_msg = f"Role '{actual_role_name}' permission issues: {'; '.join(permission_errors)}"
                fail(error_msg)
                return False, error_msg
        
        return True, "Execution role is correct."
    except ClientError as e:
        msg = f"Error checking role for {name}: {e}"
        warn(msg)
        return False, msg


def resolve_trigger_to_resource(trigger_name: str, cfg: Dict, health_input, connect_storage: Dict = None) -> Tuple[str, List[str]]:
    """
    Resolve a trigger name to its actual resource ARN and required actions.
    
    Chain: trigger → EventSourceMapping → event_source → KinesisStream/S3 → ARN
    
    Args:
        trigger_name: Name of the EventSourceMapping trigger
        cfg: Full config with EventSourceMappings, KinesisStreams, S3Buckets
        health_input: Health check input with region, account_id
        connect_storage: Connect-discovered resources (for ImportXML/MultiOrg)
    
    Returns:
        Tuple of (resource_arn, list_of_required_actions)
    """
    from utils.logging_utils import debug
    from utils.condition_evaluator import get_resolved_resource_name
    
    # Find the EventSourceMapping with this trigger name
    event_source_name = None
    for esm in cfg.get("EventSourceMappings", []):
        if esm.get("resource_name") == trigger_name or esm.get("name") == trigger_name:
            event_source_name = esm.get("event_source")
            break
    
    if not event_source_name:
        debug(f"Could not find EventSourceMapping for trigger: {trigger_name}")
        return None, []
    
    # Get account_id and region from health_input
    account_id = getattr(health_input, 'account_id', None) if health_input else None
    region = getattr(health_input, 'region', 'us-east-1') if health_input else 'us-east-1'
    
    if not account_id:
        # Try to get from STS
        import boto3
        try:
            account_id = boto3.client("sts").get_caller_identity()["Account"]
        except Exception:
            debug("Could not determine account_id for resource ARN")
            return None, []
    
    # Check if it's a Kinesis stream
    for stream in cfg.get("KinesisStreams", []):
        if stream.get("resource_name") == event_source_name:
            stream_name = get_resolved_resource_name(stream)
            
            # For ImportXML/MultiOrg, use Connect-configured stream as source of truth
            if connect_storage:
                if "CTR" in event_source_name.upper():
                    connect_stream = connect_storage.get('ctr_stream_arn')
                    if connect_stream:
                        debug(f"Using Connect-configured CTR stream: {connect_stream}")
                        return connect_stream, ["kinesis:GetRecords", "kinesis:GetShardIterator", "kinesis:DescribeStream"]
                elif "CONTACTLENS" in event_source_name.upper() or "CONTACT_LENS" in event_source_name.upper():
                    connect_stream = connect_storage.get('contact_lens_stream_arn')
                    if connect_stream:
                        debug(f"Using Connect-configured Contact Lens stream: {connect_stream}")
                        return connect_stream, ["kinesis:GetRecords", "kinesis:GetShardIterator", "kinesis:DescribeStream"]
            
            # Use config stream
            if stream_name and not stream_name.startswith("$"):
                arn = f"arn:aws:kinesis:{region}:{account_id}:stream/{stream_name}"
                debug(f"Resolved trigger {trigger_name} to Kinesis stream: {arn}")
                return arn, ["kinesis:GetRecords", "kinesis:GetShardIterator", "kinesis:DescribeStream"]
    
    # Check if it's an S3 bucket trigger
    for bucket in cfg.get("S3Buckets", []):
        if bucket.get("resource_name") == event_source_name:
            bucket_name = get_resolved_resource_name(bucket)
            
            # For ImportXML/MultiOrg, use Connect-configured bucket
            if connect_storage:
                connect_bucket = connect_storage.get('call_recordings_s3_bucket')
                if connect_bucket:
                    debug(f"Using Connect-configured S3 bucket: {connect_bucket}")
                    return f"arn:aws:s3:::{connect_bucket}/*", ["s3:GetObject", "s3:ListBucket"]
            
            if bucket_name and not bucket_name.startswith("$"):
                arn = f"arn:aws:s3:::{bucket_name}/*"
                debug(f"Resolved trigger {trigger_name} to S3 bucket: {arn}")
                return arn, ["s3:GetObject", "s3:ListBucket"]
    
    debug(f"Could not resolve event_source '{event_source_name}' to a resource")
    return None, []


def lambda_layer_exists(layer_name: str, lmb_client: Any) -> Tuple[bool, str]:
    """Check if a Lambda layer exists"""
    paginator = lmb_client.get_paginator("list_layers")
    try:
        for page in paginator.paginate():
            if any(layer["LayerName"] == layer_name for layer in page.get("Layers", [])):
                ok(f"Layer exists: {layer_name}")
                return True, "healthy"
        msg = f"Layer missing: {layer_name}"
        fail(msg)
        return False, msg
    except ClientError as e:
        msg = f"Error looking up layer {layer_name}: {e}"
        warn(msg)
        return False, msg


def get_lambda_policy(function_name: str, lmb_client: Any) -> Optional[Dict]:
    """Get Lambda function resource policy"""
    try:
        policy_str = lmb_client.get_policy(FunctionName=function_name)["Policy"]
        return json.loads(policy_str)
    except ClientError as e:
        if e.response["Error"]["Code"] != "ResourceNotFoundException":
            warn(f"Could not get policy for Lambda {function_name}: {e}")
    try:
        policy_str_alias = lmb_client.get_policy(FunctionName=function_name, Qualifier='active')["Policy"]
        return json.loads(policy_str_alias)
    except ClientError as e:
        if e.response["Error"]["Code"] != "ResourceNotFoundException":
            warn(f"Could not get policy for alias 'active' on {function_name}: {e}")
    return None


# IAM Helper Functions

def iam_role_exists(role: str, iam_client: Any) -> Tuple[bool, str]:
    """Check if an IAM role exists"""
    try:
        iam_client.get_role(RoleName=role)
        ok(f"IAM role exists: {role}")
        return True, "healthy"
    except ClientError:
        msg = f"IAM role missing: {role}"
        fail(msg)
        return False, msg


def role_has_min_policies(role: str, required: List[str], iam_client: Any) -> Tuple[bool, str]:
    """Check if IAM role has minimum required policies"""
    if not required:
        return True, "No minimum policies expected."
    try:
        attached_policies = iam_client.list_attached_role_policies(RoleName=role)["AttachedPolicies"]
        attached_names = {p["PolicyName"] for p in attached_policies}
        missing = [p for p in required if p not in attached_names]
        if not missing:
            ok(f"Role '{role}' has all minimum policies.")
            return True, "All minimum policies are attached."
        else:
            msg = f"Role '{role}' is missing policies: {missing}"
            fail(msg)
            return False, msg
    except ClientError as e:
        msg = f"Error listing policies for {role}: {e}"
        warn(msg)
        return False, msg


def managed_policy_valid(name: str, expected_actions: List[str], iam_client: Any) -> Tuple[bool, str]:
    """Check if managed policy has expected actions"""
    try:
        policies = iam_client.list_policies(Scope="Local")["Policies"]
        arn = next((p["Arn"] for p in policies if p["PolicyName"] == name), None)
        if not arn:
            fail(f"Managed policy missing: {name}")
            return False, f"Managed policy missing: {name}"
        
        ver_id = iam_client.get_policy(PolicyArn=arn)["Policy"]["DefaultVersionId"]
        doc = iam_client.get_policy_version(PolicyArn=arn, VersionId=ver_id)["PolicyVersion"]["Document"]
        actual_actions = {act for s in doc.get("Statement", []) for act in (s.get("Action") if isinstance(s.get("Action"), list) else [s.get("Action", [])]) if s.get("Action")}
        
        missing_actions = [
            exp for exp in expected_actions 
            if not(exp in actual_actions or (exp.endswith('*') and any(a.startswith(exp[:-1]) for a in actual_actions)))
        ]
        
        if not missing_actions:
            ok(f"Managed policy '{name}' is valid.")
            return True, "All expected actions are present."
        else:
            msg = f"Policy '{name}' is missing actions: {missing_actions}"
            fail(msg)
            return False, msg
    except ClientError as e:
        msg = f"Error checking policy {name}: {e}"
        warn(msg)
        return False, msg


def simulate_actions(role: str, actions: List[str], iam_client: Any, account_id: str, resource_arn: str="*") -> List[Tuple[bool, str]]:
    """
    Simulate IAM actions for a role.
    
    This function checks permissions using an intersection-based approach:
    1. Action must exist in role policies (identity policy)
    2. Action must be allowed by permission boundary (if one exists)
    
    Effective Permission = Role Policy ∩ Permission Boundary
    """
    results = []
    policy_source_arn = f"arn:aws:iam::{account_id}:role/{role}"
    
    role_actual_actions = None
    boundary_result = None  # Tuple: (has_boundary, boundary_actions)
    boundary_checked = False
    
    for act in actions:
        # For wildcard actions (e.g., "s3:Get*", "connect:*"), we cannot use IAM simulation
        # because simulate_principal_policy doesn't accept wildcards in ActionNames.
        # Use intersection check: Role Policy ∩ Permission Boundary
        if '*' in act:
            if role_actual_actions is None:
                role_actual_actions = _get_role_actual_actions(role, iam_client)
            
            # Check if the expected wildcard pattern matches any actual permission
            if role_actual_actions is None:
                results.append((False, f"Simulation: Role '{role}' - Could not retrieve policies to verify wildcard action '{act}'"))
                continue
            
            # Check if action exists in role policy
            action_in_policy = False
            covering_permission = None
            
            if act in role_actual_actions:
                action_in_policy = True
                covering_permission = act
            else:
                broader_wildcard = _find_covering_wildcard(act, role_actual_actions)
                if broader_wildcard:
                    action_in_policy = True
                    covering_permission = broader_wildcard
            
            if not action_in_policy:
                # Check what specific actions exist (for informative error message)
                matched_actions = _match_wildcard_action(act, role_actual_actions)
                if matched_actions:
                    results.append((False, f"Simulation: Role '{role}' MISSING wildcard permission '{act}' - has {len(matched_actions)} specific actions ({', '.join(list(matched_actions)[:3])}...) but not the wildcard itself"))
                else:
                    results.append((False, f"Simulation: Role '{role}' MISSING permissions matching '{act}' (no matching actions found in role policies)"))
                continue
            
            # Action exists in policy - now check permission boundary
            if not boundary_checked:
                boundary_result = _get_permission_boundary_actions(role, iam_client)
                boundary_checked = True
            
            has_boundary, boundary_actions = boundary_result
            if has_boundary:
                if boundary_actions is None:
                    # Boundary exists but we couldn't retrieve it - report error
                    results.append((False, f"Simulation: Role '{role}' - Could not verify '{act}' (permission boundary exists but retrieval failed)"))
                    continue
                # Permission boundary exists - check intersection
                if not _action_allowed_by_boundary(act, boundary_actions):
                    results.append((False, f"Simulation: Role '{role}' BLOCKED '{act}' - permission exists in role policy but NOT allowed by permission boundary"))
                    continue
            
            # Action is in role policy and allowed by boundary (or no boundary)
            results.append((True, f"Simulation: Role '{role}' HAS permission '{covering_permission}'"))
            continue
        
        # For non-wildcard actions, use IAM simulation first, then verify with intersection check
        try:
            resp = iam_client.simulate_principal_policy(
                PolicySourceArn=policy_source_arn,
                ActionNames=[act],
                ResourceArns=[resource_arn],
            )
            decision = resp["EvaluationResults"][0]["EvalDecision"]
            
            if decision == "allowed":
                results.append((True, f"Simulation: Role '{role}' ALLOWS '{act}'."))
            elif decision == "explicitDeny":
                # explicitDeny means there's a Deny statement explicitly blocking this action
                results.append((False, f"Simulation: Role '{role}' BLOCKED '{act}' - explicitly denied by permission boundary, SCP, or policy (Reason: explicitDeny)"))
            else:
                # implicitDeny - check intersection of role policy and permission boundary
                if role_actual_actions is None:
                    role_actual_actions = _get_role_actual_actions(role, iam_client)
                
                action_in_policy = False
                covering_permission = None
                if role_actual_actions is not None:
                    if act in role_actual_actions:
                        action_in_policy = True
                        covering_permission = act
                    else:
                        for w in role_actual_actions:
                            if '*' in w and _action_matches_wildcard(act, w):
                                action_in_policy = True
                                covering_permission = w
                                break
                
                if not action_in_policy:
                    # Action doesn't exist in role policy - it's missing
                    results.append((False, f"Simulation: Role '{role}' MISSING permission '{act}' (not found in role policies)"))
                    continue
                
                # Action exists in policy - check permission boundary
                if not boundary_checked:
                    boundary_result = _get_permission_boundary_actions(role, iam_client)
                    boundary_checked = True
                
                has_boundary, boundary_actions = boundary_result
                if has_boundary:
                    if boundary_actions is None:
                        # Boundary exists but we couldn't retrieve it - report error
                        results.append((False, f"Simulation: Role '{role}' - Could not verify '{act}' (permission boundary exists but retrieval failed)"))
                        continue
                    # Permission boundary exists - check if action is allowed
                    if not _action_allowed_by_boundary(act, boundary_actions):
                        results.append((False, f"Simulation: Role '{role}' BLOCKED '{act}' - permission exists in role policy but NOT allowed by permission boundary"))
                        continue
                
                # Action is in role policy and allowed by boundary (or no boundary)
                # implicitDeny was likely due to resource constraint mismatch
                results.append((True, f"Simulation: Role '{role}' HAS permission '{covering_permission}' for '{act}'"))
                    
        except ClientError as e:
            # If simulation fails, fall back to intersection check
            error_code = e.response.get("Error", {}).get("Code", "Unknown")
            if role_actual_actions is None:
                role_actual_actions = _get_role_actual_actions(role, iam_client)
            
            if role_actual_actions is None:
                results.append((False, f"Simulation: Role '{role}' - Could not verify action '{act}' (simulation error: {error_code}, policy retrieval failed)"))
                continue
            
            action_in_policy = False
            covering_permission = None
            if act in role_actual_actions:
                action_in_policy = True
                covering_permission = act
            elif any(w for w in role_actual_actions if '*' in w and _action_matches_wildcard(act, w)):
                covering = [w for w in role_actual_actions if '*' in w and _action_matches_wildcard(act, w)]
                action_in_policy = True
                covering_permission = covering[0]
            
            if not action_in_policy:
                results.append((False, f"Simulation: Role '{role}' MISSING permission '{act}' (simulation error: {error_code})"))
                continue
            
            # Check permission boundary
            if not boundary_checked:
                boundary_result = _get_permission_boundary_actions(role, iam_client)
                boundary_checked = True
            
            has_boundary, boundary_actions = boundary_result
            if has_boundary:
                if boundary_actions is None:
                    results.append((False, f"Simulation: Role '{role}' - Could not verify '{act}' (permission boundary exists but retrieval failed)"))
                elif not _action_allowed_by_boundary(act, boundary_actions):
                    results.append((False, f"Simulation: Role '{role}' BLOCKED '{act}' - permission exists in role policy but NOT allowed by permission boundary"))
                else:
                    results.append((True, f"Simulation: Role '{role}' HAS permission '{covering_permission}' (verified via policy check)"))
            else:
                results.append((True, f"Simulation: Role '{role}' HAS permission '{covering_permission}' (verified via policy check)"))
                
    return results


def _get_role_actual_actions(role: str, iam_client: Any) -> Optional[set]:
    """
    Get all actions from role's attached managed policies and inline policies.
    
    Returns:
        Set of all action strings from the role's policies, or None if retrieval failed.
    """
    from utils.logging_utils import debug
    
    all_actions = set()
    retrieval_errors = []
    
    # Get attached managed policies
    try:
        attached_policies = iam_client.list_attached_role_policies(RoleName=role).get("AttachedPolicies", [])
        debug(f"Role '{role}' has {len(attached_policies)} attached managed policies")
        
        for policy in attached_policies:
            try:
                policy_arn = policy["PolicyArn"]
                # Get the default version
                policy_details = iam_client.get_policy(PolicyArn=policy_arn)
                version_id = policy_details["Policy"]["DefaultVersionId"]
                policy_doc = iam_client.get_policy_version(PolicyArn=policy_arn, VersionId=version_id)["PolicyVersion"]["Document"]
                
                # Extract actions from policy document
                for statement in policy_doc.get("Statement", []):
                    if statement.get("Effect") == "Allow":
                        actions = statement.get("Action", [])
                        if isinstance(actions, str):
                            actions = [actions]
                        all_actions.update(actions)
                debug(f"Extracted actions from managed policy '{policy_arn}'")
            except ClientError as e:
                # Log but continue - some AWS managed policies may not be accessible
                debug(f"Could not read managed policy '{policy.get('PolicyArn', 'unknown')}': {e}")
    except ClientError as e:
        retrieval_errors.append(f"list_attached_role_policies: {e}")
        debug(f"Could not list attached policies for role '{role}': {e}")
    
    # Get inline policies
    try:
        inline_policy_names = iam_client.list_role_policies(RoleName=role).get("PolicyNames", [])
        debug(f"Role '{role}' has {len(inline_policy_names)} inline policies: {inline_policy_names}")
        
        for policy_name in inline_policy_names:
            try:
                policy_doc = iam_client.get_role_policy(RoleName=role, PolicyName=policy_name)["PolicyDocument"]
                for statement in policy_doc.get("Statement", []):
                    if statement.get("Effect") == "Allow":
                        actions = statement.get("Action", [])
                        if isinstance(actions, str):
                            actions = [actions]
                        all_actions.update(actions)
                debug(f"Extracted actions from inline policy '{policy_name}': found {len(actions)} actions")
            except ClientError as e:
                retrieval_errors.append(f"get_role_policy({policy_name}): {e}")
                debug(f"Could not read inline policy '{policy_name}': {e}")
    except ClientError as e:
        retrieval_errors.append(f"list_role_policies: {e}")
        debug(f"Could not list inline policies for role '{role}': {e}")
    
    # If we had any retrieval errors, return None to indicate we couldn't reliably determine permissions
    # This prevents false negatives where we report permissions as "missing" when they might exist
    # in a policy we couldn't read
    if retrieval_errors:
        if all_actions:
            warn(f"Partial policy retrieval for role '{role}': found {len(all_actions)} actions but encountered errors: {'; '.join(retrieval_errors)}. Returning None to avoid false negatives - verify HealthCheck Lambda has iam:ListRolePolicies and iam:GetRolePolicy permissions.")
        else:
            warn(f"Could not retrieve policies for role '{role}': {'; '.join(retrieval_errors)}")
        return None
    
    debug(f"Role '{role}' total actions found: {len(all_actions)}")
    if all_actions:
        debug(f"Sample actions: {list(all_actions)[:10]}")
    
    return all_actions


def _get_permission_boundary_actions(role: str, iam_client: Any) -> Tuple[bool, Optional[set]]:
    """
    Get all allowed actions from role's permission boundary.
    
    Returns:
        Tuple of (has_boundary, actions):
        - (False, None) = no boundary attached to role
        - (True, set(...)) = boundary exists and actions retrieved successfully
        - (True, None) = boundary exists but retrieval failed
    """
    from utils.logging_utils import debug, info, warn
    
    try:
        # Get role info to find permission boundary
        role_info = iam_client.get_role(RoleName=role)
        boundary = role_info.get("Role", {}).get("PermissionsBoundary", {})
        boundary_arn = boundary.get("PermissionsBoundaryArn")
        
        if not boundary_arn:
            debug(f"Role '{role}' has no permission boundary attached")
            return (False, None)  # No boundary attached
        
        info(f"Role '{role}' has permission boundary: {boundary_arn}")
        
        # Get boundary policy document
        try:
            policy_details = iam_client.get_policy(PolicyArn=boundary_arn)
            version_id = policy_details["Policy"]["DefaultVersionId"]
            policy_doc = iam_client.get_policy_version(PolicyArn=boundary_arn, VersionId=version_id)["PolicyVersion"]["Document"]
        except ClientError as e:
            warn(f"Could not retrieve permission boundary policy for role '{role}': {e}. HealthCheck Lambda may need iam:GetPolicy and iam:GetPolicyVersion permissions.")
            return (True, None)  # Boundary exists but retrieval failed
        
        # Extract allowed actions from boundary
        boundary_actions = set()
        for statement in policy_doc.get("Statement", []):
            if statement.get("Effect") == "Allow":
                actions = statement.get("Action", [])
                if isinstance(actions, str):
                    actions = [actions]
                boundary_actions.update(actions)
        
        info(f"Permission boundary has {len(boundary_actions)} allowed actions: {list(boundary_actions)[:10]}...")
        return (True, boundary_actions)
        
    except ClientError as e:
        warn(f"Could not check permission boundary for role '{role}': {e}")
        return (True, None)  # Assume boundary might exist but we couldn't check


def _action_allowed_by_boundary(action: str, boundary_actions: set) -> bool:
    """
    Check if an action is allowed by the permission boundary.
    
    Args:
        action: The action to check (e.g., "kms:Decrypt")
        boundary_actions: Set of actions allowed by the permission boundary
        
    Returns:
        True if action is allowed by boundary, False otherwise
    """
    from utils.logging_utils import debug
    
    # Check exact match
    if action in boundary_actions:
        debug(f"Action '{action}' found in boundary (exact match)")
        return True
    
    # Check if a wildcard in boundary covers this action
    for boundary_action in boundary_actions:
        if '*' in boundary_action and _action_matches_wildcard(action, boundary_action):
            debug(f"Action '{action}' covered by boundary wildcard '{boundary_action}'")
            return True
    
    debug(f"Action '{action}' NOT found in permission boundary")
    return False


def _match_wildcard_action(pattern: str, actual_actions: set) -> set:
    """
    Match a wildcard action pattern against a set of actual actions.
    
    Args:
        pattern: Expected action with wildcards (e.g., "iam:*Role*", "s3:Get*")
        actual_actions: Set of actual action strings from role policies
        
    Returns:
        Set of actual actions that match the pattern
    """
    regex = _wildcard_to_regex(pattern)
    
    matched = set()
    for action in actual_actions:
        # Direct match
        if regex.match(action):
            matched.add(action)
        # Also check if actual action is a wildcard that covers the pattern
        # e.g., if role has "s3:*" and we expect "s3:GetObject"
        elif '*' in action:
            actual_regex = _wildcard_to_regex(action)
            # Check if the non-wildcard part of pattern is covered
            pattern_no_wildcard = pattern.replace('*', '')
            if actual_regex.match(pattern_no_wildcard) or _pattern_covers_pattern(action, pattern):
                matched.add(action)
    
    return matched


def _find_covering_wildcard(expected_pattern: str, actual_actions: set) -> Optional[str]:
    """
    Find a wildcard action in actual_actions that covers the expected pattern.
    
    E.g., if expected is "connect:Describe*" and actual has "connect:*", 
    returns "connect:*" because it covers the expected pattern.
    
    Args:
        expected_pattern: The expected action pattern (e.g., "connect:Describe*")
        actual_actions: Set of actual actions from the role's policies
        
    Returns:
        The covering wildcard action if found, None otherwise
    """
    for action in actual_actions:
        if '*' in action and action != expected_pattern:
            # Check if this wildcard covers the expected pattern
            if _pattern_covers_pattern(action, expected_pattern):
                return action
    
    return None


def _action_matches_wildcard(action: str, wildcard_pattern: str) -> bool:
    """
    Check if a specific action matches a wildcard pattern.
    
    E.g., "s3:GetObject" matches "s3:*" or "s3:Get*"
    
    Args:
        action: Specific action like "s3:GetObject"
        wildcard_pattern: Wildcard pattern like "s3:*" or "s3:Get*"
        
    Returns:
        True if the action matches the wildcard pattern
    """
    regex = _wildcard_to_regex(wildcard_pattern)
    return regex.match(action) is not None


def _pattern_covers_pattern(actual_pattern: str, expected_pattern: str) -> bool:
    """
    Check if an actual wildcard pattern from a role covers an expected wildcard pattern.
    
    E.g., "iam:*" covers "iam:*Role*" because any action covered by "iam:*Role*" 
    would also be covered by "iam:*".
    """
    # Simple case: if actual is broader (e.g., "s3:*" covers "s3:Get*")
    # Split into service:action
    actual_parts = actual_pattern.split(':', 1)
    expected_parts = expected_pattern.split(':', 1)
    
    if len(actual_parts) != 2 or len(expected_parts) != 2:
        return False
    
    actual_service, actual_action = actual_parts
    expected_service, expected_action = expected_parts
    
    # Services must match (or actual is wildcard)
    if actual_service != expected_service and actual_service != '*':
        return False
    
    # If actual action is just "*", it covers everything
    if actual_action == '*':
        return True
    
    # Check if actual action pattern covers expected action pattern
    # e.g., "Get*" covers "GetObject", "*Role*" covers "CreateRole"
    # Convert to regex and check if expected's non-wildcard parts fit within actual's pattern
    actual_regex = _wildcard_to_regex(actual_action)
    
    # Get specific parts of expected pattern (replace wildcards with sample text)
    # This is a heuristic - check if the structure matches
    expected_specific = expected_action.replace('*', 'WILDCARD')
    
    # If actual has wildcards in the same positions or broader, it covers
    return actual_regex.match(expected_specific.replace('WILDCARD', 'x')) is not None


# CloudWatch Helper Functions

def alarm_exists(name: str, cw_client: Any) -> Tuple[Optional[Dict], str]:
    """Check if CloudWatch alarm exists"""
    try:
        paginator = cw_client.get_paginator("describe_alarms")
        for page in paginator.paginate(AlarmNames=[name]):
            if page["MetricAlarms"]:
                ok(f"Alarm exists: {name}")
                return page["MetricAlarms"][0], "healthy"
        msg = f"Alarm missing: {name}"
        fail(msg)
        return None, msg
    except ClientError as e:
        msg = f"Error checking alarm {name}: {e}"
        fail(msg)
        return None, msg


# S3 Helper Functions

def s3_bucket_exists(name: str, s3_client: Any) -> Tuple[bool, str]:
    """Check if S3 bucket exists"""
    try:
        s3_client.head_bucket(Bucket=name)
        ok(f"S3 bucket exists: {name}")
        return True, "healthy"
    except ClientError as e:
        msg = f"S3 bucket missing (Error: {e.response['Error']['Code']}): {name}"
        fail(msg)
        return False, msg


def s3_policy_exists(name: str, s3_client: Any) -> Tuple[bool, str]:
    """Check if S3 bucket has a policy"""
    try:
        s3_client.get_bucket_policy(Bucket=name)
        ok(f"Bucket policy attached: {name}")
        return True, "Policy exists."
    except ClientError as e:
        if e.response['Error']['Code'] == 'NoSuchBucketPolicy':
            msg = f"Bucket policy missing for {name}"
            fail(msg)
            return False, msg
        else:
            msg = f"Error checking policy for {name}: {e.response['Error']['Code']}"
            warn(msg)
            return False, msg


# Kinesis Helper Functions

def kinesis_stream_exists(name: str, all_streams: set) -> Tuple[bool, str]:
    """Check if Kinesis stream exists"""
    if name in all_streams:
        ok(f"Kinesis stream exists: {name}")
        return True, "healthy"
    else:
        msg = f"Kinesis stream missing: {name}"
        fail(msg)
        return False, msg


# KMS Helper Functions

def get_alias_target(alias_name: str, kms_client: Any) -> Tuple[Optional[str], str]:
    """Get KMS alias target key ID"""
    paginator = kms_client.get_paginator('list_aliases')
    try:
        for page in paginator.paginate():
            for alias in page.get('Aliases', []):
                if alias.get('AliasName') == alias_name:
                    target_id = alias.get('TargetKeyId')
                    if target_id:
                        ok(f"KMS alias exists and has a target: {alias_name}")
                        return target_id, "Alias exists and has a target key."
                    else:
                        msg = f"KMS alias exists but has no target key: {alias_name}"
                        fail(msg)
                        return None, msg
        msg = f"KMS alias missing: {alias_name}"
        fail(msg)
        return None, msg
    except ClientError as e:
        msg = f"Error listing KMS aliases: {e}"
        warn(msg)
        return None, msg


def key_is_enabled(key_id: str, kms_client: Any) -> Tuple[bool, str]:
    """Check if KMS key is enabled"""
    try:
        response = kms_client.describe_key(KeyId=key_id)
        key_metadata = response.get('KeyMetadata', {})
        if key_metadata.get('Enabled', False):
            ok(f"Target KMS key '{key_id}' is Enabled.")
            return True, "KMS Key is enabled."
        else:
            msg = f"Target KMS key '{key_id}' is not Enabled (State: {key_metadata.get('KeyState')})"
            fail(msg)
            return False, msg
    except ClientError as e:
        msg = f"Error describing KMS key '{key_id}': {e}"
        warn(msg)
        return False, msg


# Utility Functions

def combine_results(resource_name: str, results: List[Tuple[bool, str]]) -> Dict:
    """Combine multiple check results for a single resource into a report item"""
    failure_messages = [msg for success, msg in results if not success]
    
    if not failure_messages:
        return {"ResourceName": resource_name, "status": 200, "message": "healthy"}
    else:
        combined_message = "; ".join(failure_messages)
        return {"ResourceName": resource_name, "status": 500, "message": combined_message}

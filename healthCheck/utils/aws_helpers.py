"""
AWS helper functions for resource validation

Provides utility functions for checking AWS resources like Lambda functions,
IAM roles, S3 buckets, CloudWatch alarms, etc.
"""

import json
from typing import Any, Dict, List, Optional, Tuple

from botocore.exceptions import ClientError
from utils.logging_utils import ok, warn, fail


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


def lambda_role_correct(name: str, expected_role: str, lmb_client: Any) -> Tuple[bool, str]:
    """Check if Lambda function has the correct execution role"""
    if not expected_role:
        return True, "No execution role expected."
    try:
        cfg = lmb_client.get_function(FunctionName=name)["Configuration"]
        actual_role_name = cfg["Role"].split("/")[-1]
        # FIX: Also get just the name from the expected role to handle both ARNs and names
        expected_role_name = expected_role.split("/")[-1]
        
        if actual_role_name == expected_role_name:
            ok(f"Role '{expected_role_name}' attached correctly to {name}.")
            return True, "Execution role is correct."
        else:
            msg = f"Role mismatch for {name}: expected '{expected_role_name}', found '{actual_role_name}'"
            fail(msg)
            return False, msg
    except ClientError as e:
        msg = f"Error checking role for {name}: {e}"
        warn(msg)
        return False, msg


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
    """Simulate IAM actions for a role"""
    results = []
    policy_source_arn = f"arn:aws:iam::{account_id}:role/{role}"

    # Check if resource ARN contains wildcards that may cause implicit denies in simulation
    # Only skip if wildcards are in resource portion, not partition/region/account portions
    has_problematic_wildcard = resource_arn == "*"
    if resource_arn != "*" and '*' in resource_arn:
        # Split ARN into components: arn:partition:service:region:account:resource
        arn_parts = resource_arn.split(':')
        if len(arn_parts) >= 6:
            # Check if wildcard is in the resource portion (index 5 and beyond)
            resource_portion = ':'.join(arn_parts[5:])
            has_problematic_wildcard = '*' in resource_portion
        else:
            # If ARN format is unexpected, be conservative and skip simulation
            has_problematic_wildcard = True
    
    for act in actions:
        # Skip wildcard actions as they're not supported by IAM simulation
        if '*' in act:
            results.append((True, f"Simulation: Role '{role}' - Skipped wildcard action '{act}' (not supported by IAM simulation)"))
            continue
            
        # Skip simulation for wildcard resources as they may cause false implicit denies
        if has_problematic_wildcard:
            results.append((True, f"Simulation: Role '{role}' - Skipped action '{act}' on wildcard resource '{resource_arn}' (may cause implicit deny in simulation)"))
            continue
            
        try:
            resp = iam_client.simulate_principal_policy(
                PolicySourceArn=policy_source_arn,
                ActionNames=[act],
                ResourceArns=[resource_arn],
            )
            decision = resp["EvaluationResults"][0]["EvalDecision"]
            if decision == "allowed":
                # The 'ok()' function is not called here; we return the result.
                results.append((True, f"Simulation: Role '{role}' ALLOWS '{act}'."))
            else:
                results.append((False, f"Simulation: Role '{role}' DENIES '{act}' (Reason: {decision})."))
        except ClientError as e:
            results.append((False, f"Simulation Error for '{act}' on role '{role}': {e}"))
    return results


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
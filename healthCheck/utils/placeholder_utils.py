"""
Placeholder replacement utilities for AWS Resource Health Check Lambda

Handles dynamic value replacement in configuration templates.
"""

import re
from typing import Any, Dict

# Regex pattern for matching ${variable} placeholders
PLACEHOLDER_RE = re.compile(r"\$\{([^}]+)\}")

# Regex pattern for matching conditional placeholders (name1|name2) anywhere in the string
CONDITIONAL_RE = re.compile(r"([^|\s]+\|[^|\s]+)")


def resolve_conditional_placeholder(value: str, replacements: Dict[str, str]) -> str:
    """
    Resolve conditional placeholders with priority for LambdaPrefix/lambdaPrefix.
    
    Handles strings containing conditional format "option1|option2" where:
    - If option1 contains LambdaPrefix/lambdaPrefix and it's available, use option1
    - If option2 contains LambdaPrefix/lambdaPrefix and it's available, use option2
    - Otherwise, use the first option that can be fully resolved
    - If neither can be resolved, return the original string
    
    Args:
        value: String potentially containing conditional format "option1|option2"
        replacements: Dictionary mapping placeholder names to replacement values
        
    Returns:
        The resolved string with the appropriate option selected
        
    Example:
        >>> value = "SCV Lambda ${CallCenterApiName}-Function|${LambdaPrefix}-Function Errors"
        >>> replacements = {"CallCenterApiName": "mycc", "LambdaPrefix": "myorg"}
        >>> resolve_conditional_placeholder(value, replacements)
        "SCV Lambda myorg-Function Errors"  # LambdaPrefix takes priority
    """
    def replace_conditional_match(match):
        conditional_part = match.group(1)
        # Split the conditional part by |
        parts = conditional_part.split('|')
        if len(parts) != 2:
            return match.group(0)  # Return original if not exactly 2 parts
        
        option1, option2 = parts
        return resolve_conditional_options(option1, option2, replacements)
    
    # Replace all conditional placeholders in the string
    return CONDITIONAL_RE.sub(replace_conditional_match, value)


def resolve_conditional_options(option1: str, option2: str, replacements: Dict[str, str]) -> str:
    """
    Resolve between two conditional options with priority for LambdaPrefix/lambdaPrefix.
    
    Args:
        option1: First option string
        option2: Second option string
        replacements: Dictionary mapping placeholder names to replacement values
        
    Returns:
        The resolved option string
    """
    # Check if either option contains LambdaPrefix/lambdaPrefix
    option1_has_lambda_prefix = ("${LambdaPrefix}" in option1 or "${lambdaPrefix}" in option1)
    option2_has_lambda_prefix = ("${LambdaPrefix}" in option2 or "${lambdaPrefix}" in option2)
    
    # Priority 1: Option with LambdaPrefix/lambdaPrefix that can be resolved
    if option1_has_lambda_prefix:
        lambda_prefix = replacements.get("LambdaPrefix") or replacements.get("lambdaPrefix")
        if lambda_prefix and lambda_prefix not in ["LambdaPrefix", "lambdaPrefix", ""]:
            # LambdaPrefix is available and not just a placeholder or empty, use option1
            return replace_placeholders_in_string(option1, replacements)
    
    if option2_has_lambda_prefix:
        lambda_prefix = replacements.get("LambdaPrefix") or replacements.get("lambdaPrefix")
        if lambda_prefix and lambda_prefix not in ["LambdaPrefix", "lambdaPrefix", ""]:
            # LambdaPrefix is available and not just a placeholder or empty, use option2
            return replace_placeholders_in_string(option2, replacements)
    
    # Priority 2: First option that can be fully resolved (no unresolved placeholders)
    # But skip options that would result in empty prefixes (e.g., "-FunctionName")
    option1_resolved = replace_placeholders_in_string(option1, replacements)
    if not PLACEHOLDER_RE.search(option1_resolved) and not option1_resolved.startswith('-'):
        return option1_resolved
    
    option2_resolved = replace_placeholders_in_string(option2, replacements)
    if not PLACEHOLDER_RE.search(option2_resolved) and not option2_resolved.startswith('-'):
        return option2_resolved
    
    # Priority 3: If neither can be fully resolved, prefer the one that doesn't start with dash
    if not option1_resolved.startswith('-') and not option2_resolved.startswith('-'):
        # If both are valid, prefer the one with LambdaPrefix
        if option1_has_lambda_prefix:
            return option1_resolved
        if option2_has_lambda_prefix:
            return option2_resolved
        return option1_resolved
    elif not option1_resolved.startswith('-'):
        return option1_resolved
    elif not option2_resolved.startswith('-'):
        return option2_resolved
    
    # Fallback: Use first option (even if it starts with dash)
    return option1_resolved


def resolve_cloudformation_references(text: str, replacements: Dict[str, str]) -> str:
    """
    Resolve CloudFormation-style references like ResourceName.Arn to actual ARN patterns.
    
    Args:
        text: String potentially containing CloudFormation references
        replacements: Dictionary mapping placeholder names to replacement values
        
    Returns:
        String with CloudFormation references resolved to ARN patterns
    """
    # Pattern to match ResourceName.Arn references
    cf_ref_pattern = re.compile(r"([A-Za-z][A-Za-z0-9]*(?:Resource)?(?:Role)?(?:Policy)?)\.Arn")
    
    def resolve_arn_reference(match):
        resource_name = match.group(1)
        
        # Get AWS context from replacements
        partition = replacements.get("AWS::Partition", "aws")
        account_id = replacements.get("AWS::AccountId", "${AWS::AccountId}")
        
        # Handle different resource types
        if "Role" in resource_name:
            # IAM Role ARN pattern
            # Convert resource name to actual role name using lambdaPrefix if available
            lambda_prefix = replacements.get("lambdaPrefix") or replacements.get("LambdaPrefix")
            if lambda_prefix and lambda_prefix not in ["", "LambdaPrefix", "lambdaPrefix"]:
                # For multiorg resources, use lambdaPrefix pattern
                if resource_name.startswith("Multiorg"):
                    # MultiorgMigrationRole -> ${lambdaPrefix}-MultiorgMigrationRole
                    role_name = f"{lambda_prefix}-{resource_name.replace('Resource', '').replace('Role', 'Role')}"
                else:
                    # Other roles -> ${lambdaPrefix}-RoleName
                    role_name = f"{lambda_prefix}-{resource_name.replace('Resource', '')}"
            else:
                # Fallback to CallCenterApiName pattern
                call_center_name = replacements.get("CallCenterApiName", "${CallCenterApiName}")
                role_name = f"{call_center_name}-{resource_name.replace('Resource', '')}"
            
            return f"arn:{partition}:iam::{account_id}:role/{role_name}"
        
        elif "Policy" in resource_name:
            # IAM Policy ARN pattern
            lambda_prefix = replacements.get("lambdaPrefix") or replacements.get("LambdaPrefix")
            if lambda_prefix and lambda_prefix not in ["", "LambdaPrefix", "lambdaPrefix"]:
                policy_name = f"{lambda_prefix}-{resource_name.replace('Resource', '')}"
            else:
                call_center_name = replacements.get("CallCenterApiName", "${CallCenterApiName}")
                policy_name = f"{call_center_name}-{resource_name.replace('Resource', '')}"
            
            return f"arn:{partition}:iam::{account_id}:policy/{policy_name}"
        
        else:
            # For other resources, return as-is for now
            return match.group(0)
    
    return cf_ref_pattern.sub(resolve_arn_reference, text)


def resolve_custom_resource_outputs(text: str, replacements: Dict[str, str]) -> str:
    """
    Resolve custom resource output references like ResourceName.OutputName.
    
    Args:
        text: String potentially containing custom resource references
        replacements: Dictionary mapping placeholder names to replacement values
        
    Returns:
        String with custom resource references resolved
    """
    # Pattern to match CustomResource.OutputName references
    custom_ref_pattern = re.compile(r"([A-Za-z][A-Za-z0-9]*CustomResource)\.([A-Za-z][A-Za-z0-9]*)")
    
    def resolve_custom_reference(match):
        resource_name = match.group(1)
        output_name = match.group(2)
        
        # Get AWS context from replacements
        partition = replacements.get("AWS::Partition", "aws")
        account_id = replacements.get("AWS::AccountId", "${AWS::AccountId}")
        region = replacements.get("AWS::Region", "${AWS::Region}")
        
        if "StreamDiscovery" in resource_name and "StreamArn" in output_name:
            # MultiorgStreamDiscoveryCustomResource.CTRStreamArn -> Kinesis stream ARN
            lambda_prefix = replacements.get("lambdaPrefix") or replacements.get("LambdaPrefix")
            if lambda_prefix and lambda_prefix not in ["", "LambdaPrefix", "lambdaPrefix"]:
                stream_name = f"{lambda_prefix}-{output_name.replace('Arn', '')}"
            else:
                call_center_name = replacements.get("CallCenterApiName", "${CallCenterApiName}")
                stream_name = f"{call_center_name}-{output_name.replace('Arn', '')}"
            
            return f"arn:{partition}:kinesis:{region}:{account_id}:stream/{stream_name}"
        
        # For other custom resources, return as-is for now
        return match.group(0)
    
    return custom_ref_pattern.sub(resolve_custom_reference, text)


def clean_duplicate_prefixes(text: str, replacements: Dict[str, str]) -> str:
    """
    Clean up duplicate prefixes that can occur from nested parameter substitution.
    
    Args:
        text: String potentially containing duplicate prefixes
        replacements: Dictionary mapping placeholder names to replacement values
        
    Returns:
        String with duplicate prefixes cleaned up
    """
    lambda_prefix = replacements.get("lambdaPrefix") or replacements.get("LambdaPrefix")
    if not lambda_prefix or lambda_prefix in ["", "LambdaPrefix", "lambdaPrefix"]:
        return text
    
    # Pattern to match duplicate prefixes like "scvMultiorg-scvMultiorg-"
    duplicate_pattern = re.compile(f"{re.escape(lambda_prefix)}-{re.escape(lambda_prefix)}-")
    
    # Replace with single prefix
    return duplicate_pattern.sub(f"{lambda_prefix}-", text)


def fix_multiorg_role_references(text: str, replacements: Dict[str, str]) -> str:
    """
    Fix CloudFormation role references that don't match actual deployed role names.
    
    The generated JSON contains references like "MultiorgContactDataSyncFunctionRoleResource.Arn"
    but the actual role names in AWS are different (e.g., "scvMultiorg-ContactDataSyncFunctionRole"
    instead of "scvMultiorg-MultiorgContactDataSyncFunctionRole").
    
    Args:
        text: String potentially containing CloudFormation role references
        replacements: Dictionary mapping placeholder names to replacement values
        
    Returns:
        String with role references fixed to match actual AWS role names
    """
    # Mapping from CloudFormation resource references to actual role ARN patterns
    lambda_prefix = replacements.get("lambdaPrefix") or replacements.get("LambdaPrefix")
    if not lambda_prefix or lambda_prefix in ["", "LambdaPrefix", "lambdaPrefix"]:
        return text
    
    partition = replacements.get("AWS::Partition", "aws")
    account_id = replacements.get("AWS::AccountId", "${AWS::AccountId}")
    
    # Role reference mappings based on actual CloudFormation role names
    role_mappings = {
        "MultiorgMigrationRole.Arn": f"arn:{partition}:iam::{account_id}:role/{lambda_prefix}-MultiorgMigrationRole",
        "MultiorgInvokeTelephonyIntegrationApiFunctionRoleResource.Arn": f"arn:{partition}:iam::{account_id}:role/{lambda_prefix}-InvokeTelephonyIntegrationApiFunctionRole",
        "MultiorgContactDataSyncFunctionRoleResource.Arn": f"arn:{partition}:iam::{account_id}:role/{lambda_prefix}-ContactDataSyncFunctionRole",
        "MultiorgPostCallAnalysisTriggerFunctionRoleResource.Arn": f"arn:{partition}:iam::{account_id}:role/{lambda_prefix}-PostCallAnalysisTriggerFunctionRole",
        "MultiorgInvokeSalesforceRestApiFunctionRoleResource.Arn": f"arn:{partition}:iam::{account_id}:role/{lambda_prefix}-InvokeSalesforceRestApiFunctionRole",
        "MultiorgKvsTranscriberRoleResource.Arn": f"arn:{partition}:iam::{account_id}:role/{lambda_prefix}-KvsTranscriberRole",
        "MultiorgKvsConsumerTriggerRoleResource.Arn": f"arn:{partition}:iam::{account_id}:role/{lambda_prefix}-KvsConsumerTriggerRole",
        "MultiorgContactLensConsumerFunctionRoleResource.Arn": f"arn:{partition}:iam::{account_id}:role/{lambda_prefix}-ContactLensConsumerFunctionRole",
        "MultiorgVoiceMailAudioProcessingRoleResource.Arn": f"arn:{partition}:iam::{account_id}:role/{lambda_prefix}-VoiceMailAudioProcessingRole",
        "MultiorgVoiceMailPackagingRoleResource.Arn": f"arn:{partition}:iam::{account_id}:role/{lambda_prefix}-VoiceMailPackagingRole",
        "MultiorgVoiceMailTranscribeRoleResource.Arn": f"arn:{partition}:iam::{account_id}:role/{lambda_prefix}-VoiceMailTranscribeRole",
        "MultiorgHandleContactEventsRoleResource.Arn": f"arn:{partition}:iam::{account_id}:role/{lambda_prefix}-HandleContactEventsRole",
        "MultiorgStreamDiscoveryFunctionRoleResource.Arn": f"arn:{partition}:iam::{account_id}:role/{lambda_prefix}-StreamDiscoveryFunctionRole",
        "S3SecretCacheTTLRole.Arn": f"arn:{partition}:iam::{account_id}:role/{lambda_prefix}-S3SecretCacheTTLRole"
    }
    
    # Replace any matching role references
    for cf_ref, actual_arn in role_mappings.items():
        text = text.replace(cf_ref, actual_arn)
    
    return text


def fix_custom_resource_outputs(text: str, replacements: Dict[str, str]) -> str:
    """
    Fix custom resource output references like MultiorgStreamDiscoveryCustomResource.CTRStreamArn.
    
    Args:
        text: String potentially containing custom resource references
        replacements: Dictionary mapping placeholder names to replacement values
        
    Returns:
        String with custom resource references resolved to actual discovered ARNs
    """
    lambda_prefix = replacements.get("lambdaPrefix") or replacements.get("LambdaPrefix")
    if not lambda_prefix or lambda_prefix in ["", "LambdaPrefix", "lambdaPrefix"]:
        return text
    
    partition = replacements.get("AWS::Partition", "aws")
    account_id = replacements.get("AWS::AccountId", "${AWS::AccountId}")
    region = replacements.get("AWS::Region", "${AWS::Region}")
    connect_instance_id = replacements.get("ConnectInstanceId")
    
    # Try to discover actual stream ARNs for multiorg scenarios
    custom_mappings = {}
    
    # Check if we need to resolve stream references and have the required info
    if (("MultiorgStreamDiscoveryCustomResource.CTRStreamArn" in text or 
         "MultiorgStreamDiscoveryCustomResource.ContactLensStreamArn" in text) and
        connect_instance_id and connect_instance_id != "ConnectInstanceId"):
        
        try:
            # Use existing stream discovery function
            print(f"DEBUG: Attempting stream discovery for instance {connect_instance_id} in region {region}")
            from .stream_discovery import discover_connect_streams
            discovered_streams = discover_connect_streams(connect_instance_id, region if region != "${AWS::Region}" else None)
            print(f"DEBUG: Stream discovery result: {discovered_streams}")
            
            # Map discovered streams to custom resource references
            if discovered_streams.get('ctr_stream_arn'):
                custom_mappings["MultiorgStreamDiscoveryCustomResource.CTRStreamArn"] = discovered_streams['ctr_stream_arn']
            
            if discovered_streams.get('contact_lens_stream_arn'):
                custom_mappings["MultiorgStreamDiscoveryCustomResource.ContactLensStreamArn"] = discovered_streams['contact_lens_stream_arn']
                
        except Exception as e:
            print(f"DEBUG: Stream discovery failed, using fallback patterns: {e}")
    
    # Fallback to pattern-based resolution if discovery failed or not needed
    if "MultiorgStreamDiscoveryCustomResource.CTRStreamArn" not in custom_mappings:
        custom_mappings["MultiorgStreamDiscoveryCustomResource.CTRStreamArn"] = f"arn:{partition}:kinesis:{region}:{account_id}:stream/{lambda_prefix}-CTRStream"
    
    if "MultiorgStreamDiscoveryCustomResource.ContactLensStreamArn" not in custom_mappings:
        custom_mappings["MultiorgStreamDiscoveryCustomResource.ContactLensStreamArn"] = f"arn:{partition}:kinesis:{region}:{account_id}:stream/{lambda_prefix}-ContactLensStream"
    
    # Replace any matching custom resource references
    for cf_ref, actual_arn in custom_mappings.items():
        text = text.replace(cf_ref, actual_arn)
    
    return text


def replace_placeholders_in_string(text: str, replacements: Dict[str, str]) -> str:
    """
    Replace ${variable} placeholders in a single string.
    
    Args:
        text: String containing placeholders
        replacements: Dictionary mapping placeholder names to replacement values
        
    Returns:
        String with placeholders replaced
    """
    # First fix CloudFormation role and custom resource references
    text = fix_multiorg_role_references(text, replacements)
    text = fix_custom_resource_outputs(text, replacements)
    
    # Then replace regular placeholders
    text = PLACEHOLDER_RE.sub(
        lambda m: str(replacements.get(m.group(1), m.group(0))),
        text
    )
    
    # Finally clean up any duplicate prefixes
    text = clean_duplicate_prefixes(text, replacements)
    
    return text


def replace_placeholders(data: Any, replacements: Dict[str, str]) -> Any:
    """
    Recursively traverses a data structure and replaces all ${variable} placeholders.
    Also handles conditional placeholders in the format "option1|option2" with priority
    for LambdaPrefix/lambdaPrefix when available.
    
    Args:
        data: The data structure to process (dict, list, str, or other)
        replacements: Dictionary mapping placeholder names to replacement values
        
    Returns:
        The data structure with placeholders replaced
        
    Example:
        >>> data = {"name": "${CallCenterApiName}-Function|${LambdaPrefix}-Function"}
        >>> replacements = {"CallCenterApiName": "mycc", "LambdaPrefix": "myorg"}
        >>> replace_placeholders(data, replacements)
        {"name": "myorg-Function"}  # LambdaPrefix takes priority
    """
    if isinstance(data, dict):
        return {k: replace_placeholders(v, replacements) for k, v in data.items()}
    if isinstance(data, list):
        return [replace_placeholders(item, replacements) for item in data]
    if isinstance(data, str):
        # First handle conditional placeholders
        resolved = resolve_conditional_placeholder(data, replacements)
        # Then handle regular placeholders
        return replace_placeholders_in_string(resolved, replacements)
    return data
"""
Condition evaluator for resolving CloudFormation conditions at runtime.
"""

import os
import re
from typing import Dict, Any, Optional
from utils.logging_utils import debug


def evaluate_condition(condition_name: str) -> bool:
    """
    Evaluate a CloudFormation condition using environment variables.
    
    Args:
        condition_name: The condition name to evaluate
        
    Returns:
        bool: True if condition is met, False otherwise
    """
    # Truly generic condition evaluation using pattern detection
    env_var, negate = _detect_condition_pattern(condition_name)
    
    if env_var:
        # Normal environment variable evaluation
        env_value = os.environ.get(env_var, "")
        
        # No special SKU handling needed - conditions should be resolved by generator
        
        # Standard evaluation: True if env_value is non-empty
        is_non_empty = env_value != ""
        result = not is_non_empty if negate else is_non_empty
        
        debug(f"Condition {condition_name}: {env_var}='{env_value}' -> {result}")
        return result
    
    # Default: include resource if condition is unknown
    debug(f"Unknown condition {condition_name}, defaulting to True")
    return True


def _detect_condition_pattern(condition_name: str):
    """
    Automatically detect the environment variable and negation from condition name patterns.
    
    This function uses naming conventions to dynamically determine:
    1. Which environment variable to check
    2. Whether the condition should be negated
    
    Patterns supported:
    - "ParameterName" -> check PARAMETER_NAME env var, True when non-empty
    - "NOT_ParameterName" -> check PARAMETER_NAME env var, True when empty
    - "DoCreate*" -> check CUSTOMER_CONFIGURED_S3_BUCKET_NAME, True when empty
    - "DoNotCreate*" -> check CUSTOMER_CONFIGURED_S3_BUCKET_NAME, True when non-empty
    - "CreateEventTriggers" -> False for multiorg/importxml SKUs (no realtime alerts)
    
    Args:
        condition_name: The condition name to analyze
        
    Returns:
        tuple: (env_var_name, negate_flag) or (None, False) if pattern not recognized
    """
    # Handle NOT_ prefix pattern
    negate = False
    base_name = condition_name
    if condition_name.startswith("NOT_"):
        base_name = condition_name[4:]  # Remove "NOT_" prefix
        negate = True
    
    env_var = _convert_to_env_var_name(base_name)

    if env_var and env_var in os.environ:
        return env_var, negate  # True when non-empty
    
    # Pattern not recognized
    return None, negate


def _convert_to_env_var_name(param_name: str) -> str:
    """
    Convert a parameter name to its corresponding environment variable name.
    
    Uses algorithmic conversion: CamelCase -> UPPER_SNAKE_CASE
    
    Args:
        param_name: Parameter name (e.g., "CustomerConfiguredS3BucketName")
        
    Returns:
        str: Environment variable name (e.g., "CUSTOMER_CONFIGURED_S3_BUCKET_NAME")
    """
    # Convert CamelCase to UPPER_SNAKE_CASE algorithmically
    snake_case = re.sub('([A-Z]+)', r'_\1', param_name).upper().lstrip('_')
    return snake_case


def resolve_resource_name(name: str) -> str:
    """
    Resolve conditional resource names using environment variables.
    
    This function handles conditional resource names in the format "option1|option2"
    and determines which option to use based on runtime environment variables.
    
    Args:
        name: Resource name that may contain conditional logic (e.g., "option1|option2")
        
    Returns:
        str: Resolved resource name
    """
    if '|' not in name:
        # No conditional logic, return as-is (after placeholder resolution)
        return resolve_placeholders(name)
    
    # Split conditional name: "option1|option2"
    options = name.split('|')
    if len(options) != 2:
        # Invalid format, return as-is
        debug(f"Invalid conditional format '{name}', expected 'option1|option2'")
        return resolve_placeholders(name)
    
    option1, option2 = options
    
    # Truly generic approach: analyze which option should be used based on placeholder resolution
    # Extract placeholders from both options to determine which environment variables they depend on
    import re
    
    def extract_placeholders(text):
        """Extract placeholder names from text like ${PlaceholderName}"""
        return re.findall(r'\$\{([^}]+)\}', text)
    
    option1_placeholders = extract_placeholders(option1)
    option2_placeholders = extract_placeholders(option2)
    
    # Check both options for customer-configured placeholders and evaluate which to use
    def get_customer_vars_from_option(placeholders):
        """Extract and check customer-configured environment variables from placeholders"""
        customer_vars_set = []
        for placeholder in placeholders:
            if "CustomerConfigured" in placeholder:
                # Convert placeholder to environment variable name
                import re
                env_var = placeholder
                # Handle sequences like CTRStreamARN -> CTR_STREAM_ARN
                env_var = re.sub('([A-Z])([A-Z][a-z])', r'\1_\2', env_var)  # Handle CTRStream -> CTR_Stream
                env_var = re.sub('([a-z0-9])([A-Z])', r'\1_\2', env_var)    # Handle StreamARN -> Stream_ARN
                env_var = env_var.upper()
                
                if os.environ.get(env_var, ""):
                    customer_vars_set.append(env_var)
        return customer_vars_set
    
    # Check both options for customer configuration
    option1_customer_vars = get_customer_vars_from_option(option1_placeholders)
    option2_customer_vars = get_customer_vars_from_option(option2_placeholders)
    
    # Determine which option to use based on available customer configuration
    if option1_customer_vars:
        # Option1 has customer config and those vars are set - use option1
        resolved_name = resolve_placeholders(option1)
        debug(f"Conditional name '{name}' resolved to '{resolved_name}' (option1 customer-configured: {option1_customer_vars})")
        return resolved_name
    elif option2_customer_vars:
        # Option2 has customer config and those vars are set - use option2
        resolved_name = resolve_placeholders(option2)
        debug(f"Conditional name '{name}' resolved to '{resolved_name}' (option2 customer-configured: {option2_customer_vars})")
        return resolved_name
    
    # Default to option1 (SCV-managed or no customer config)
    resolved_name = resolve_placeholders(option1)
    debug(f"Conditional name '{name}' resolved to '{resolved_name}' (SCV-managed)")
    return resolved_name


def resolve_placeholders(text: str) -> str:
    """
    Resolve CloudFormation placeholders using environment variables.
    
    Args:
        text: Text containing placeholders like ${ParameterName}
        
    Returns:
        str: Text with placeholders resolved
    """
    if not text:
        return text
    
    # Define placeholder mappings
    placeholder_mappings = {
        "S3BucketForTenantResources": os.environ.get("S3_BUCKET_FOR_TENANT_RESOURCES", ""),
        "CustomerConfiguredS3BucketName": os.environ.get("CUSTOMER_CONFIGURED_S3_BUCKET_NAME", ""),
        "AWS::AccountId": os.environ.get("AWS_ACCOUNT_ID", ""),
        "CallCenterApiName": os.environ.get("CALL_CENTER_API_NAME", ""),
        "LambdaPrefix": os.environ.get("LAMBDA_PREFIX", ""),
    }
    
    # Replace placeholders
    result = text
    for placeholder, value in placeholder_mappings.items():
        pattern = f"${{{placeholder}}}"
        if pattern in result and value:
            result = result.replace(pattern, value)
            debug(f"Resolved placeholder {pattern} -> {value}")
    
    return result


def should_validate_resource(resource: Dict[str, Any]) -> bool:
    """
    Determine if a resource should be validated based on its condition.
    
    Args:
        resource: Resource definition from the configuration
        
    Returns:
        bool: True if resource should be validated, False to skip
    """
    condition = resource.get("condition")
    resource_name = resource.get("resource_name", "unknown")
    
    if not condition:
        # No explicit condition - check if this resource has implicit runtime conditions
        # based on its resource name patterns
        if _has_implicit_runtime_condition(resource):
            should_validate = _evaluate_implicit_condition(resource)
            debug(f"Resource {resource_name} implicit condition -> {'validate' if should_validate else 'skip'}")
            return should_validate
        else:
            # No condition, always validate
            return True
    
    should_validate = evaluate_condition(condition)
    debug(f"Resource {resource_name} condition {condition} -> {'validate' if should_validate else 'skip'}")
    
    return should_validate


def _has_implicit_runtime_condition(resource: Dict[str, Any]) -> bool:
    """Check if a resource has implicit runtime conditions based on its name/type."""
    resource_name = resource.get("resource_name", "")
    
    # Resources that depend on DoCreateS3Bucket condition (SCV-managed)
    s3_scv_dependent_resources = [
        "S3BucketCorsConfigurationFunction",
        "S3BucketCorsConfigurationRole", 
        "S3Bucket"
    ]
    
    # Resources that depend on DoNotCreateS3Bucket condition (customer-configured)
    s3_customer_dependent_resources = [
        "S3BucketEventBridgeConfigurationFunction",
        "S3BucketEventBridgeConfigurationRole"
    ]
    
    return (resource_name in s3_scv_dependent_resources or 
            resource_name in s3_customer_dependent_resources)


def _evaluate_implicit_condition(resource: Dict[str, Any]) -> bool:
    """Evaluate implicit runtime condition for a resource."""
    resource_name = resource.get("resource_name", "")
    
    # Check if customer provided S3 bucket
    customer_bucket = os.environ.get("CUSTOMER_CONFIGURED_S3_BUCKET_NAME", "")
    
    # SCV-managed S3 resources should only exist when using SCV-managed buckets
    if resource_name in ["S3BucketCorsConfigurationFunction", "S3BucketCorsConfigurationRole"]:
        return not customer_bucket  # True when customer bucket is empty (SCV-managed)
    
    # Customer-configured S3 resources should only exist when using customer buckets  
    elif resource_name in ["S3BucketEventBridgeConfigurationFunction", "S3BucketEventBridgeConfigurationRole"]:
        return bool(customer_bucket)  # True when customer bucket is provided
    
    elif resource_name == "S3Bucket":
        # S3Bucket itself is always validated, but name resolution depends on condition
        return True
    
    # Default: validate the resource
    return True


def get_resolved_resource_name(resource: Dict[str, Any]) -> str:
    """
    Get the resolved name for a resource, handling conditional logic.
    
    Args:
        resource: Resource definition from the configuration
        
    Returns:
        str: Resolved resource name
    """
    name = resource.get("name", "")
    return resolve_resource_name(name)





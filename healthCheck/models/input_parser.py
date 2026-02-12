"""
Input parameter parsing for AWS Resource Health Check Lambda

Handles parsing and validation of Lambda event input parameters.
"""

import os
from typing import Dict

from .health_models import HealthCheckInput
from utils.logging_utils import fail, debug
from utils.arn_utils import parse_connect_instance_arn
from utils.id_utils import generate_execution_id, is_valid_execution_id


def parse_input_parameters(event: Dict) -> HealthCheckInput:
    """
    Parse and validate input parameters from Lambda event
    
    Args:
        event: Lambda event dictionary containing input parameters
        
    Returns:
        HealthCheckInput: Parsed and validated input parameters
        
    Raises:
        ValueError: If required parameters are missing or invalid
        
    Configuration from environment variables:
    
    Required (set by CloudFormation):
    - VERSION: CC version (e.g., "19.0") 
    - CALL_CENTER_API_NAME: Call center API name (e.g., "callorigintest")
    - SKU: SKU type (e.g., "RESELL" -> maps to "resell", "BYOA" -> maps to "byoa", "ENTERPRISE" -> maps to "enterprise")
    - CONNECT_INSTANCE_ID: Connect instance ID (used to build ARN)
    - S3_BUCKET_FOR_TENANT_RESOURCES: S3 bucket for tenant resources
    - LAMBDA_PREFIX: Lambda function prefix (e.g., "scvMultiorg" for multiorg SKU)
    
    Automatic (available from Lambda runtime & AWS STS):
    - AWS_REGION: AWS region (automatically set by Lambda runtime)
    - Account ID: Retrieved via STS GetCallerIdentity
    - AWS Partition: Determined from region (aws, aws-cn, aws-us-gov)
    
    Input event (all optional):
        {
            "execution_id": "exec-123-456",  # OPTIONAL - will be generated if not provided
            "max_threads": 10,               # OPTIONAL - defaults to 10
            "include_detailed_errors": true  # OPTIONAL - defaults to true
        }
    """
    try:
        # Extract all parameters from environment variables
        cc_version = os.environ.get("VERSION")  # From CloudFormation VERSION parameter
        cc_name = os.environ.get("CALL_CENTER_API_NAME")  # From CloudFormation CallCenterApiName parameter  
        sku = os.environ.get("SKU", "").lower()  # From CloudFormation SKU parameter (RESELL -> resell, BYOA -> byoa, ENTERPRISE -> enterprise)
        
        # Build Connect instance ARN from available AWS information
        connect_instance_id = os.environ.get("CONNECT_INSTANCE_ID")
        if connect_instance_id:
            # Get AWS information from Lambda runtime and STS
            region = os.environ.get("AWS_REGION")  # Automatically set by Lambda runtime
            
            # Get account ID and partition from STS (no env vars needed)
            try:
                import boto3
                sts_client = boto3.client("sts")
                caller_identity = sts_client.get_caller_identity()
                account_id = caller_identity["Account"]
                
                # Determine partition from region
                if region.startswith("cn-"):
                    partition = "aws-cn"
                elif region.startswith("us-gov-"):
                    partition = "aws-us-gov"
                else:
                    partition = "aws"
                    
            except Exception as e:
                debug(f"Could not get AWS identity from STS: {e}")
                raise ValueError("Failed to determine AWS account ID and partition for ARN construction")
                
            connect_instance_arn = f"arn:{partition}:connect:{region}:{account_id}:instance/{connect_instance_id}"
            debug(f"Built Connect instance ARN: {connect_instance_arn}")
        else:
            connect_instance_arn = None
            
        # S3 bucket from CloudFormation parameter
        s3_bucket_for_tenant_resources = os.environ.get("S3_BUCKET_FOR_TENANT_RESOURCES")
        s3_bucket_for_reports = os.environ.get("S3_BUCKET_FOR_REPORTS")
        
        # Lambda prefix from CloudFormation parameter
        lambda_prefix = os.environ.get("LAMBDA_PREFIX")
        
        # Handle execution_id (optional - generate if not provided)
        execution_id = event.get("execution_id")
        if not execution_id:
            execution_id = generate_execution_id()
            debug(f"Generated execution_id: {execution_id}")
        else:
            # Validate provided execution_id
            if not is_valid_execution_id(execution_id):
                raise ValueError(f"Invalid execution_id format: {execution_id}")
            debug(f"Using provided execution_id: {execution_id}")
        
        # Validate all required fields (excluding execution_id since it's now optional)
        required_fields = {
            "cc_version": cc_version,
            "cc_name": cc_name,
            "sku": sku,
            "connect_instance_arn": connect_instance_arn
        }
        
        missing_fields = [field_name for field_name, field_value in required_fields.items() if not field_value]
        
        if missing_fields:
            env_var_mapping = {
                "cc_version": "VERSION",
                "cc_name": "CALL_CENTER_API_NAME", 
                "sku": "SKU",
                "connect_instance_arn": "CONNECT_INSTANCE_ID (to build ARN)"
            }
            missing_details = []
            for field in missing_fields:
                env_var = env_var_mapping.get(field, field.upper())
                missing_details.append(f"{field} (requires {env_var} environment variable)")
            
            raise ValueError(f"Missing required environment variables: {', '.join(missing_details)}")
        
        # Parse Connect instance ARN to extract region, account_id, and instance_id
        try:
            arn_components = parse_connect_instance_arn(connect_instance_arn)
            region = arn_components['region']
            account_id = arn_components['account_id']
            partition = arn_components['partition']
            connect_instance_id = arn_components['instance_id']
            debug(f"Parsed ARN components: region={region}, account_id={account_id}, partition={partition}, instance_id={connect_instance_id}")
        except ValueError as e:
            raise ValueError(f"Invalid connect_instance_arn: {str(e)}")
        
        # Allow override of region from environment if needed
        fallback_region = os.environ.get("AWS_REGION")
        if fallback_region and not region:
            region = fallback_region
        
        # Validate S3 bucket is available from environment variable
        if not s3_bucket_for_tenant_resources:
            raise ValueError("S3 bucket for tenant resources is required. Set environment variable 'S3_BUCKET_FOR_TENANT_RESOURCES'")
        
        debug(f"Using S3 bucket: {s3_bucket_for_tenant_resources}")
        
        # Create input object
        health_input = HealthCheckInput(
            # Required fields
            cc_version=cc_version,
            cc_name=cc_name,
            sku=sku,
            execution_id=execution_id,
            connect_instance_arn=connect_instance_arn,
            s3_bucket_for_tenant_resources=s3_bucket_for_tenant_resources,
            s3_bucket_for_reports=s3_bucket_for_reports,
            # Optional fields (extracted from ARN or provided separately)
            region=region,
            connect_instance_id=connect_instance_id,
            account_id=account_id,
            partition=partition,
            lambda_prefix=lambda_prefix,
            call_center_api_name=cc_name,  # Use the same unified value for both fields
            include_detailed_errors=event.get("include_detailed_errors", True),
            max_threads=event.get("max_threads", 10)
        )
        
        debug(f"Input parameters parsed: Execution ID={health_input.execution_id}, CC Version={health_input.cc_version}, CC Name={health_input.cc_name}, SKU={health_input.sku}, Region={health_input.region}")
        
        return health_input
        
    except Exception as e:
        error_msg = f"Failed to parse input parameters: {str(e)}"
        fail(error_msg)
        raise ValueError(error_msg)
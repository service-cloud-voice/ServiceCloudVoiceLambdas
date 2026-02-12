from __future__ import annotations

import json
import datetime
# Typing imports moved to respective modules


import boto3
from botocore.exceptions import ClientError

# Import utility modules
from utils.logging_utils import setup_logging, get_logger, fail, info, debug, ok, is_debug_enabled
from utils.placeholder_utils import replace_placeholders
from utils.s3_utils import upload_report_to_s3

# Import models
from models.input_parser import parse_input_parameters

# Import core functionality
from core.config import load_expected_from_layer
from core.multithreading import MultiThreadedValidator
from core.reporting import generate_enhanced_report

# Global AWS account setup
sts = boto3.client("sts")

try:
    ACCOUNT_ID = sts.get_caller_identity()["Account"]
except ClientError as e:
    # Initialize logging first for proper error handling
    setup_logging()
    fail(f"FATAL: Could not determine AWS Account ID. Error: {e}")
    ACCOUNT_ID = "UNKNOWN"  # Fallback to prevent crashes


def lambda_handler(event, context):
    """
    AWS Resource Health Check Lambda Handler
    
    Execution timing is automatically included when log level is set to INFO/DEBUG/TRACE.
    Set LOG_LEVEL=INFO environment variable to enable detailed timing information.
    
    Environment Variables:
    
    Required (set by CloudFormation):
    - VERSION=19.0 (CC version)
    - CALL_CENTER_API_NAME=callorigintest (from CallCenterApiName parameter)  
    - SKU=RESELL (SKU type: RESELL -> "resell", BYOA -> "byoa", ENTERPRISE -> "enterprise")
    - CONNECT_INSTANCE_ID=187da78c-d6e4-4e39-a6f5-cc3d3310e7a2 (used to build ARN)
    - S3_BUCKET_FOR_TENANT_RESOURCES=callorigintest-409137744801
    - LAMBDA_PREFIX=scvMultiorg (Lambda function prefix for multiorg or importxml SKU)
    
    Automatic (Lambda runtime & AWS APIs):
    - AWS_REGION=us-west-2 (automatically set by Lambda runtime)
    - Account ID: Retrieved via STS GetCallerIdentity API
    - AWS Partition: Determined from region (aws, aws-cn, aws-us-gov)
    
    Input event (all optional):
    {
        "execution_id": "hc-20250902-120000-test1234",  # OPTIONAL (auto-generated if not provided)
        "max_threads": 10,                              # OPTIONAL (defaults to 10)
        "include_detailed_errors": true                 # OPTIONAL (defaults to true)
    }
    """
    execution_start = datetime.datetime.now(datetime.timezone.utc)
    execution_id = "unknown"  # Default fallback value
    
    # Initialize logging system
    setup_logging()
    logger = get_logger()
    
    logger.info("AWS RESOURCE VALIDATOR - Starting health check")
    
    try:
        health_input = parse_input_parameters(event)
        execution_id = health_input.execution_id  # Use execution_id from input
        
        logger.info(f"Execution ID: {execution_id}")
        
        # Account ID, partition, region, and instance ID are now extracted from the ARN
        ACCOUNT_ID = health_input.account_id
        partition = health_input.partition
        CONNECT_INSTANCE_ID = health_input.connect_instance_id
        
        # Verify we have all required components from ARN parsing
        if not ACCOUNT_ID or not partition or not CONNECT_INSTANCE_ID:
            fail("Failed to extract required components from connect_instance_arn")
            raise ValueError("Invalid ARN components extracted")
        
        debug(f"AWS Environment: Account={ACCOUNT_ID}, Partition={partition}, Region={health_input.region}")
        info(f"CC Configuration: Version={health_input.cc_version}, Name={health_input.cc_name}, SKU={health_input.sku}")
        
        placeholder_map = {
            "AWS::Region": health_input.region,
            "AWS::AccountId": ACCOUNT_ID,
            "AWS::Partition": partition,
            "ConnectInstanceId": health_input.connect_instance_id or "ConnectInstanceId",
            "CallCenterApiName": health_input.call_center_api_name or "CallCenterApiName",
            "S3BucketForTenantResources": health_input.s3_bucket_for_tenant_resources or "S3BucketForTenantResources",
            "LambdaPrefix": health_input.lambda_prefix or "",
            "lambdaPrefix": health_input.lambda_prefix or ""
        }
        
        # Step 4: AWS clients are now initialized within each validator module

        # Step 5: Load and process configuration
        cfg_raw = load_expected_from_layer(health_input.sku)
        debug("Replacing placeholders using values from the event payload...")
        cfg = replace_placeholders(cfg_raw, placeholder_map)
        
        # Step 5.5: Discover dynamic streams for multiorg scenarios
        if health_input.sku == "multiorg" and CONNECT_INSTANCE_ID:
            from utils.stream_discovery import discover_connect_streams, resolve_dynamic_stream_references
            
            info("Discovering Kinesis streams for multiorg deployment...")
            discovered_streams = discover_connect_streams(CONNECT_INSTANCE_ID, health_input.region)
            info(f"Stream discovery result: {discovered_streams}")
            
            # Update EventSourceMappings with discovered stream ARNs
            if "EventSourceMappings" in cfg:
                info(f"Processing {len(cfg['EventSourceMappings'])} EventSourceMappings for stream discovery...")
                for mapping in cfg["EventSourceMappings"]:
                    original_source = mapping.get("event_source", "")
                    debug(f"Processing mapping: function={mapping.get('function', 'N/A')}, original_source={original_source}")
                    resolved_source = resolve_dynamic_stream_references(original_source, discovered_streams)
                    if resolved_source is not None and resolved_source != original_source:
                        info(f"Resolved stream reference: {original_source} -> {resolved_source}")
                        mapping["event_source"] = resolved_source
                    elif resolved_source is None and ("MultiorgStreamDiscoveryCustomResource" in original_source):
                        fail(f"Failed to resolve stream reference: {original_source} - stream discovery may have failed")
                    else:
                        debug(f"No resolution needed for: {original_source}")
            else:
                info("No EventSourceMappings found in configuration")
        
        info(f"Running validation in region: {health_input.region}")

        all_lambda_names = {fn["name"] for fn in cfg.get("LambdaFunctions", [])}

        validator = MultiThreadedValidator(health_input, cfg)
        full_report = validator.validate_all_resources_parallel(all_lambda_names)

        execution_time = (datetime.datetime.now(datetime.timezone.utc) - execution_start).total_seconds() * 1000
        
        # Generate enhanced report with metadata and summary
        enhanced_report = generate_enhanced_report(
            health_input, full_report, execution_id, execution_time, validator.errors
        )
        
        s3_url = upload_report_to_s3(health_input, enhanced_report, execution_id)

        summary = enhanced_report["summary"]
        logger.info("AWS RESOURCE VALIDATOR - Validation complete")
        logger.info(f"Execution ID: {execution_id}")
        if is_debug_enabled():
            debug(f"Total execution time: {execution_time:.2f}ms")
        ok(f"Overall Status: {summary['overall_status']}")
        info(f"Resources: {summary['healthy']}/{summary['total_resources']} healthy, {summary['unhealthy']} unhealthy")
        if summary['error_count'] > 0:
            logger.warning(f"Errors: {summary['error_count']}")
        else:
            info(f"Errors: {summary['error_count']}")
        if s3_url:
            info(f"Report saved to: {s3_url}")
        logger.info("")
        
        # Return enhanced response
        response_body = {
            "execution_id": execution_id,
            "overall_status": summary["overall_status"],
            "summary": summary
        }
        
        # Only include execution time when debug logging is enabled
        if is_debug_enabled():
            response_body["execution_time_ms"] = execution_time
        
        # Always include S3 details in response
        if s3_url:
            response_body["s3_report"] = {
                "url": s3_url,
                "bucket": health_input.s3_bucket_for_reports,
                "key": f"health_report/{execution_id}.json",
                "status": "uploaded"
            }
        else:
            response_body["s3_report"] = {
                "status": "failed",
                "bucket": health_input.s3_bucket_for_reports,
                "key": f"health_report/{execution_id}.json",
                "error": "Failed to upload report to S3"
            }
        
        if health_input.include_detailed_errors:
            response_body["detailed_results"] = full_report
            response_body["errors"] = validator.errors
        
        return {
            "statusCode": 200,
            "headers": { 
                "Content-Type": "application/json",
                "X-Execution-ID": execution_id
            },
            "body": json.dumps(response_body, default=str)
        }

    except Exception as e:
        execution_time = (datetime.datetime.now(datetime.timezone.utc) - execution_start).total_seconds() * 1000
        error_msg = f"Health check failed: {str(e)}"
        fail(error_msg)
        
        # Build error response body
        error_response_body = {
            "execution_id": execution_id,
            "error": error_msg
        }
        
        # Only include execution time when debug logging is enabled
        if is_debug_enabled():
            error_response_body["execution_time_ms"] = execution_time
        
        return {
            "statusCode": 500,
            "headers": {
                "Content-Type": "application/json",
                "X-Execution-ID": execution_id
            },
            "body": json.dumps(error_response_body)
        }
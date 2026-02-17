"""
S3 utilities for health check reporting

Handles S3 operations including lifecycle policy management and report uploads.
"""

import json
import datetime
from typing import Any, Dict, Optional

import boto3
from botocore.exceptions import ClientError

from models.health_models import HealthCheckInput
from utils.logging_utils import warn, ok, info, debug


def ensure_lifecycle_policy(s3_client: Any, bucket_name: str) -> None:
    """
    Ensure S3 bucket has lifecycle policy for health_report/ folder cleanup
    
    Creates a lifecycle rule to delete files in health_report/ after 1 day
    if the rule doesn't already exist.
    """
    try:
        # Try to get existing lifecycle configuration
        try:
            response = s3_client.get_bucket_lifecycle_configuration(Bucket=bucket_name)
            existing_rules = response.get('Rules', [])
            
            # Check if health_report rule already exists
            for rule in existing_rules:
                rule_filter = rule.get('Filter', {})
                prefix = rule_filter.get('Prefix', '')
                if prefix == 'health_report/' and rule.get('Status') == 'Enabled':
                    return
                    
        except ClientError as e:
            if e.response['Error']['Code'] != 'NoSuchLifecycleConfiguration':
                raise
            # No lifecycle configuration exists yet
            existing_rules = []
        
        # Add our health_report cleanup rule
        health_report_rule = {
            'ID': 'DeleteHealthReports',
            'Status': 'Enabled',
            'Filter': {
                'Prefix': 'health_report/'
            },
            'Expiration': {
                'Days': 1
            }
        }
        
        # Combine with existing rules
        all_rules = existing_rules + [health_report_rule]
        
        # Set the lifecycle configuration
        s3_client.put_bucket_lifecycle_configuration(
            Bucket=bucket_name,
            LifecycleConfiguration={
                'Rules': all_rules
            }
        )
        
        ok(f"Created lifecycle rule for health_report/ folder in bucket {bucket_name} (1-day TTL)")
        
    except Exception as e:
        # Don't fail the upload if lifecycle policy creation fails
        warn(f"Could not create lifecycle policy for bucket {bucket_name}: {str(e)}")
        warn("Health reports will be uploaded but won't auto-expire")


def upload_report_to_s3(health_input: HealthCheckInput, report: Dict, execution_id: str) -> Optional[str]:
    """
    Upload health check report to S3 tenant bucket
    
    Files are stored as: health_report/{execution_id}.json
    Automatically sets up 1-day lifecycle policy for health_report/ folder if not exists
    """
    
    try:
        s3_client = boto3.client("s3", region_name=health_input.region)
        bucket_name = health_input.s3_bucket_for_reports
        
        # Ensure lifecycle policy exists for automatic cleanup
        ensure_lifecycle_policy(s3_client, bucket_name)
        
        # Generate file path with execution_id as filename in health_report folder
        file_key = f"health_report/{execution_id}.json"
        
        # Only JSON format is supported
        content = json.dumps(report, indent=2, default=str)
        content_type = "application/json"
        
        # Upload to S3 with metadata (ensure all values are strings)
        metadata = {
            "execution-id": str(execution_id or ""),
            "cc-version": str(health_input.cc_version or ""),
            "cc-name": str(health_input.cc_name or ""),
            "overall-status": str(report["summary"]["overall_status"] or ""),
            "total-resources": str(report["summary"]["total_resources"] or 0),
            "healthy-resources": str(report["summary"]["healthy"] or 0)
        }
        
        s3_client.put_object(
            Bucket=bucket_name,
            Key=file_key,
            Body=content.encode('utf-8'),
            ContentType=content_type,
            Metadata=metadata
        )
        
        s3_url = f"s3://{bucket_name}/{file_key}"
        ok(f"Report uploaded to S3: {s3_url}")
        return s3_url
        
    except Exception as e:
        error_msg = f"Failed to upload report to S3: {str(e)}"
        warn(error_msg)
        return None
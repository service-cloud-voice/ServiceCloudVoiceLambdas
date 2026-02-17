"""
Data models and enums for AWS Resource Health Check Lambda

Defines the core data structures used throughout the health check process.
"""

from dataclasses import dataclass
from enum import Enum
from typing import Dict, Any, Optional


class HealthStatus(Enum):
    """Enumeration of possible health check statuses"""
    HEALTHY = "HEALTHY"
    UNHEALTHY = "UNHEALTHY" 
    WARNING = "WARNING"
    UNKNOWN = "UNKNOWN"


@dataclass
class HealthCheckInput:
    """
    Structured input parameters for health check
    
    This dataclass encapsulates all the configuration parameters needed
    to run a health check, including service configuration, AWS settings,
    and output preferences.
    
    Configuration fields (from CloudFormation environment variables only):
    - cc_version: From VERSION env var
    - cc_name: From CALL_CENTER_API_NAME env var  
    - sku: From SKU env var (mapped to lowercase)
    - connect_instance_arn: Built from CONNECT_INSTANCE_ID, AWS_REGION, AWS_ACCOUNT_ID, AWS_PARTITION
    - s3_bucket_for_tenant_resources: From S3_BUCKET_FOR_TENANT_RESOURCES env var
    """
    # Configuration fields (populated from env vars or input parameters)
    cc_version: str
    cc_name: str
    sku: str
    connect_instance_arn: str
    
    # Optional fields (extracted from ARN or provided separately)
    execution_id: Optional[str] = None
    region: Optional[str] = None
    connect_instance_id: Optional[str] = None
    account_id: Optional[str] = None
    partition: Optional[str] = None
    lambda_prefix: Optional[str] = None
    call_center_api_name: Optional[str] = None
    s3_bucket_for_tenant_resources: Optional[str] = None  # Base bucket name for layer config validation
    s3_bucket_for_reports: Optional[str] = None  # Actual bucket name for S3 operations and reporting
    include_detailed_errors: bool = True
    max_threads: int = 10


@dataclass
class ResourceHealthResult:
    """
    Individual resource health check result
    
    Represents the outcome of validating a single AWS resource,
    including status, timing, and diagnostic information.
    """
    resource_name: str
    resource_type: str
    status: HealthStatus
    message: str
    details: Optional[Dict[str, Any]] = None
    execution_time_ms: Optional[float] = None
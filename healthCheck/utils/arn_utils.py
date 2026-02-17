"""
ARN parsing utilities for AWS Resource Health Check Lambda

Provides functions to parse and extract information from AWS ARNs.
"""

import re
from typing import Dict, Optional


def parse_connect_instance_arn(arn: str) -> Dict[str, str]:
    """
    Parse AWS Connect instance ARN to extract components
    
    Args:
        arn: Connect instance ARN in format:
             arn:partition:connect:region:account-id:instance/instance-id
             
    Returns:
        Dict containing: partition, region, account_id, instance_id
        
    Raises:
        ValueError: If ARN format is invalid
        
    Example:
        >>> parse_connect_instance_arn("arn:aws:connect:us-west-2:123456789012:instance/12345678-1234-1234-1234-123456789012")
        {
            'partition': 'aws',
            'region': 'us-west-2', 
            'account_id': '123456789012',
            'instance_id': '12345678-1234-1234-1234-123456789012'
        }
    """
    if not arn:
        raise ValueError("ARN cannot be empty")
    
    # ARN format: arn:partition:service:region:account-id:resource
    # Connect instance ARN: arn:aws:connect:us-west-2:123456789012:instance/instance-id
    arn_pattern = r'^arn:([^:]+):connect:([^:]+):([^:]+):instance/(.+)$'
    
    match = re.match(arn_pattern, arn)
    if not match:
        raise ValueError(f"Invalid Connect instance ARN format: {arn}")
    
    partition, region, account_id, instance_id = match.groups()
    
    # Validate components
    if not partition:
        raise ValueError("Partition cannot be empty in ARN")
    if not region:
        raise ValueError("Region cannot be empty in ARN")
    if not account_id:
        raise ValueError("Account ID cannot be empty in ARN")
    if not instance_id:
        raise ValueError("Instance ID cannot be empty in ARN")
    
    # Validate instance ID format (UUID)
    uuid_pattern = r'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    if not re.match(uuid_pattern, instance_id):
        raise ValueError(f"Invalid Connect instance ID format: {instance_id}")
    
    return {
        'partition': partition,
        'region': region,
        'account_id': account_id,
        'instance_id': instance_id
    }


def validate_arn_format(arn: str, service: str) -> bool:
    """
    Validate that an ARN has the correct format for a specific service
    
    Args:
        arn: The ARN to validate
        service: The expected AWS service (e.g., 'connect', 's3', 'lambda')
        
    Returns:
        bool: True if ARN format is valid for the service
    """
    if not arn or not service:
        return False
    
    # Basic ARN format: arn:partition:service:region:account:resource
    basic_pattern = rf'^arn:[^:]+:{re.escape(service)}:[^:]*:[^:]*:.+'
    
    return bool(re.match(basic_pattern, arn))


def extract_region_from_arn(arn: str) -> Optional[str]:
    """
    Extract region from any AWS ARN
    
    Args:
        arn: Any valid AWS ARN
        
    Returns:
        Optional[str]: The region if found, None if not present or invalid ARN
    """
    if not arn:
        return None
    
    # ARN format: arn:partition:service:region:account:resource
    parts = arn.split(':')
    if len(parts) >= 4:
        region = parts[3]
        return region if region else None
    
    return None


def extract_account_id_from_arn(arn: str) -> Optional[str]:
    """
    Extract account ID from any AWS ARN
    
    Args:
        arn: Any valid AWS ARN
        
    Returns:
        Optional[str]: The account ID if found, None if not present or invalid ARN
    """
    if not arn:
        return None
    
    # ARN format: arn:partition:service:region:account:resource
    parts = arn.split(':')
    if len(parts) >= 5:
        account_id = parts[4]
        return account_id if account_id else None
    
    return None
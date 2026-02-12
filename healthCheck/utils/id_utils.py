"""
ID generation utilities for AWS Resource Health Check Lambda

Provides functions to generate unique identifiers for executions and resources.
"""

import uuid
import datetime



def generate_execution_id() -> str:
    """
    Generate a unique execution ID for health check runs
    
    Returns:
        str: Unique execution ID in format: hc-YYYYMMDD-HHMMSS-uuid4
        
    Example:
        >>> generate_execution_id()
        'hc-20241218-143052-a1b2c3d4'
    """
    # Get current timestamp
    now = datetime.datetime.now(datetime.timezone.utc)
    timestamp = now.strftime("%Y%m%d-%H%M%S")
    
    # Generate a short UUID (first 8 characters)
    short_uuid = str(uuid.uuid4()).replace('-', '')[:8]
    
    # Combine into execution ID
    execution_id = f"hc-{timestamp}-{short_uuid}"
    
    return execution_id



def is_valid_execution_id(execution_id: str) -> bool:
    """
    Validate if an execution ID has the expected format
    
    Args:
        execution_id: The execution ID to validate
        
    Returns:
        bool: True if valid format, False otherwise
    """
    if not execution_id or not isinstance(execution_id, str):
        return False
    
    # Allow flexible formats:
    # - Our generated format: hc-YYYYMMDD-HHMMSS-uuid8
    # - User provided: any non-empty string with reasonable length
    if len(execution_id) < 3 or len(execution_id) > 100:
        return False
    
    # Check for valid characters (alphanumeric, hyphens, underscores)
    if not all(c.isalnum() or c in ['-', '_'] for c in execution_id):
        return False
    
    return True
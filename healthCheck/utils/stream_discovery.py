"""
Stream Discovery Utility for Health Check Lambda

This module provides functionality to discover actual Kinesis stream ARNs
from AWS Connect instance configuration, similar to the StreamDiscoveryFunction
used in multiorg deployments.
"""

import boto3
from typing import Dict, Optional
from botocore.exceptions import ClientError

from .logging_utils import info, debug, fail


def discover_connect_streams(connect_instance_id: str, region: str = None) -> Dict[str, Optional[str]]:
    """
    Discover actual Kinesis stream ARNs from Connect instance configuration.
    
    Args:
        connect_instance_id: The Connect instance ID
        
    Returns:
        Dict containing discovered stream ARNs:
        {
            'ctr_stream_arn': 'arn:aws:kinesis:...',
            'contact_lens_stream_arn': 'arn:aws:kinesis:...'
        }
    """
    try:
        # Create Connect client with region if provided
        if region:
            connect_client = boto3.client('connect', region_name=region)
        else:
            connect_client = boto3.client('connect')
        
        # Discover CTR Stream ARN
        ctr_stream_arn = _discover_ctr_stream(connect_client, connect_instance_id)
        
        # Discover Contact Lens Stream ARN  
        contact_lens_stream_arn = _discover_contact_lens_stream(connect_client, connect_instance_id)
        
        result = {
            'ctr_stream_arn': ctr_stream_arn,
            'contact_lens_stream_arn': contact_lens_stream_arn
        }
        
        info(f"Stream discovery completed: CTR={ctr_stream_arn is not None}, ContactLens={contact_lens_stream_arn is not None}")
        debug(f"Discovered streams: {result}")
        
        return result
        
    except Exception as e:
        fail(f"Stream discovery failed: {str(e)}")
        return {
            'ctr_stream_arn': None,
            'contact_lens_stream_arn': None
        }


def _discover_ctr_stream(connect_client, connect_instance_id: str) -> Optional[str]:
    """Discover CTR stream ARN using CONTACT_TRACE_RECORDS resource type."""
    try:
        debug(f"Discovering CTR stream for instance: {connect_instance_id}")
        
        response = connect_client.list_instance_storage_configs(
            InstanceId=connect_instance_id,
            ResourceType='CONTACT_TRACE_RECORDS'
        )
        
        if 'StorageConfigs' in response and response['StorageConfigs']:
            for config in response['StorageConfigs']:
                if config['StorageType'] == 'KINESIS_STREAM':
                    stream_arn = config['KinesisStreamConfig']['StreamArn']
                    debug(f"Found CTR stream: {stream_arn}")
                    return stream_arn
        
        debug("No CTR stream configuration found")
        return None
        
    except ClientError as e:
        fail(f"Failed to discover CTR stream: {e}")
        return None


def _discover_contact_lens_stream(connect_client, connect_instance_id: str) -> Optional[str]:
    """Discover Contact Lens stream ARN using REAL_TIME_CONTACT_ANALYSIS_SEGMENTS resource type."""
    try:
        debug(f"Discovering Contact Lens stream for instance: {connect_instance_id}")
        
        response = connect_client.list_instance_storage_configs(
            InstanceId=connect_instance_id,
            ResourceType='REAL_TIME_CONTACT_ANALYSIS_SEGMENTS'
        )
        
        if 'StorageConfigs' in response and response['StorageConfigs']:
            for config in response['StorageConfigs']:
                if config['StorageType'] == 'KINESIS_STREAM':
                    stream_arn = config['KinesisStreamConfig']['StreamArn']
                    debug(f"Found Contact Lens stream: {stream_arn}")
                    return stream_arn
        
        debug("No Contact Lens stream configuration found")
        return None
        
    except ClientError as e:
        fail(f"Failed to discover Contact Lens stream: {e}")
        return None


def resolve_dynamic_stream_references(event_source: str, discovered_streams: Dict[str, Optional[str]]) -> Optional[str]:
    """
    Resolve dynamic stream references to actual stream ARNs.
    
    Args:
        event_source: The event source from JSON (e.g., "MultiorgStreamDiscoveryCustomResource.CTRStreamArn")
        discovered_streams: Dict of discovered stream ARNs
        
    Returns:
        Actual stream ARN or None if not found
    """
    debug(f"Resolving stream reference: {event_source}")
    debug(f"Available discovered streams: {discovered_streams}")
    
    if not isinstance(event_source, str):
        debug("Event source is not a string, returning None")
        return None
    
    # Handle custom resource references
    if "MultiorgStreamDiscoveryCustomResource.CTRStreamArn" in event_source:
        resolved = discovered_streams.get('ctr_stream_arn')
        debug(f"CTR stream reference resolved to: {resolved}")
        if resolved is None:
            fail(f"CTR stream ARN not found in discovered streams: {discovered_streams}")
        return resolved
    elif "MultiorgStreamDiscoveryCustomResource.ContactLensStreamArn" in event_source:
        resolved = discovered_streams.get('contact_lens_stream_arn')
        debug(f"Contact Lens stream reference resolved to: {resolved}")
        if resolved is None:
            fail(f"Contact Lens stream ARN not found in discovered streams: {discovered_streams}")
        return resolved
    
    # For non-dynamic references, return as-is
    debug(f"No dynamic reference found, returning as-is: {event_source}")
    return event_source
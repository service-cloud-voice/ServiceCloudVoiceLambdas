"""
Tests for stream discovery utilities
"""

import pytest
from unittest.mock import patch, MagicMock
from botocore.exceptions import ClientError

# Import the module under test
import sys
sys.path.insert(0, '/Users/tkuwar/opt/workspace/aws-integration/lambdas/healthCheck')

from utils.stream_discovery import (
    discover_connect_streams,
    _discover_ctr_stream,
    _discover_contact_lens_stream
)


class TestStreamDiscovery:
    """Test cases for stream discovery functionality"""

    @patch('boto3.client')
    def test_discover_connect_streams_success(self, mock_boto3_client):
        """Test successful stream discovery"""
        # Mock Connect client
        mock_connect = MagicMock()
        mock_boto3_client.return_value = mock_connect
        
        # Mock CTR stream response
        mock_connect.list_instance_storage_configs.side_effect = [
            {
                'StorageConfigs': [{
                    'StorageType': 'KINESIS_STREAM',
                    'KinesisStreamConfig': {
                        'StreamArn': 'arn:aws:kinesis:us-west-2:123456789012:stream/ctr-stream'
                    }
                }]
            },
            {
                'StorageConfigs': [{
                    'StorageType': 'KINESIS_STREAM',
                    'KinesisStreamConfig': {
                        'StreamArn': 'arn:aws:kinesis:us-west-2:123456789012:stream/contact-lens-stream'
                    }
                }]
            }
        ]
        
        result = discover_connect_streams('test-instance-id', 'us-west-2')
        
        assert result['ctr_stream_arn'] == 'arn:aws:kinesis:us-west-2:123456789012:stream/ctr-stream'
        assert result['contact_lens_stream_arn'] == 'arn:aws:kinesis:us-west-2:123456789012:stream/contact-lens-stream'
        
        # Verify calls
        assert mock_connect.list_instance_storage_configs.call_count == 2
        mock_connect.list_instance_storage_configs.assert_any_call(
            InstanceId='test-instance-id',
            ResourceType='CONTACT_TRACE_RECORDS'
        )
        mock_connect.list_instance_storage_configs.assert_any_call(
            InstanceId='test-instance-id',
            ResourceType='REAL_TIME_CONTACT_ANALYSIS_SEGMENTS'
        )

    @patch('boto3.client')
    def test_discover_connect_streams_no_streams(self, mock_boto3_client):
        """Test stream discovery when no streams are configured"""
        mock_connect = MagicMock()
        mock_boto3_client.return_value = mock_connect
        
        # Mock empty responses
        mock_connect.list_instance_storage_configs.return_value = {
            'StorageConfigs': []
        }
        
        result = discover_connect_streams('test-instance-id')
        
        assert result['ctr_stream_arn'] is None
        assert result['contact_lens_stream_arn'] is None

    @patch('boto3.client')
    def test_discover_connect_streams_access_denied(self, mock_boto3_client):
        """Test stream discovery with access denied error"""
        mock_connect = MagicMock()
        mock_boto3_client.return_value = mock_connect
        
        # Mock access denied error
        mock_connect.list_instance_storage_configs.side_effect = ClientError(
            {'Error': {'Code': 'AccessDeniedException', 'Message': 'Access denied'}},
            'ListInstanceStorageConfigs'
        )
        
        # Function handles errors gracefully and returns None values
        result = discover_connect_streams('test-instance-id')
        
        assert result['ctr_stream_arn'] is None
        assert result['contact_lens_stream_arn'] is None

    @patch('boto3.client')
    def test_discover_connect_streams_partial_success(self, mock_boto3_client):
        """Test stream discovery with partial success (only CTR stream found)"""
        mock_connect = MagicMock()
        mock_boto3_client.return_value = mock_connect
        
        # Mock CTR success, Contact Lens failure
        mock_connect.list_instance_storage_configs.side_effect = [
            {
                'StorageConfigs': [{
                    'StorageType': 'KINESIS_STREAM',
                    'KinesisStreamConfig': {
                        'StreamArn': 'arn:aws:kinesis:us-west-2:123456789012:stream/ctr-stream'
                    }
                }]
            },
            ClientError(
                {'Error': {'Code': 'AccessDeniedException', 'Message': 'Access denied'}},
                'ListInstanceStorageConfigs'
            )
        ]
        
        # Function handles errors gracefully
        result = discover_connect_streams('test-instance-id')
        
        assert result['ctr_stream_arn'] == 'arn:aws:kinesis:us-west-2:123456789012:stream/ctr-stream'
        assert result['contact_lens_stream_arn'] is None

    @patch('boto3.client')
    def test_discover_ctr_stream_success(self, mock_boto3_client):
        """Test CTR stream discovery success"""
        mock_connect = MagicMock()
        mock_connect.list_instance_storage_configs.return_value = {
            'StorageConfigs': [{
                'StorageType': 'KINESIS_STREAM',
                'KinesisStreamConfig': {
                    'StreamArn': 'arn:aws:kinesis:us-west-2:123456789012:stream/ctr-stream'
                }
            }]
        }
        
        result = _discover_ctr_stream(mock_connect, 'test-instance-id')
        
        assert result == 'arn:aws:kinesis:us-west-2:123456789012:stream/ctr-stream'
        mock_connect.list_instance_storage_configs.assert_called_once_with(
            InstanceId='test-instance-id',
            ResourceType='CONTACT_TRACE_RECORDS'
        )

    @patch('boto3.client')
    def test_discover_ctr_stream_no_kinesis_config(self, mock_boto3_client):
        """Test CTR stream discovery with non-Kinesis storage"""
        mock_connect = MagicMock()
        mock_connect.list_instance_storage_configs.return_value = {
            'StorageConfigs': [{
                'StorageType': 'S3',
                'S3Config': {
                    'BucketName': 'test-bucket'
                }
            }]
        }
        
        result = _discover_ctr_stream(mock_connect, 'test-instance-id')
        
        assert result is None

    @patch('boto3.client')
    def test_discover_contact_lens_stream_success(self, mock_boto3_client):
        """Test Contact Lens stream discovery success"""
        mock_connect = MagicMock()
        mock_connect.list_instance_storage_configs.return_value = {
            'StorageConfigs': [{
                'StorageType': 'KINESIS_STREAM',
                'KinesisStreamConfig': {
                    'StreamArn': 'arn:aws:kinesis:us-west-2:123456789012:stream/contact-lens-stream'
                }
            }]
        }
        
        result = _discover_contact_lens_stream(mock_connect, 'test-instance-id')
        
        assert result == 'arn:aws:kinesis:us-west-2:123456789012:stream/contact-lens-stream'
        mock_connect.list_instance_storage_configs.assert_called_once_with(
            InstanceId='test-instance-id',
            ResourceType='REAL_TIME_CONTACT_ANALYSIS_SEGMENTS'
        )

    @patch('boto3.client')
    def test_discover_contact_lens_stream_empty_response(self, mock_boto3_client):
        """Test Contact Lens stream discovery with empty response"""
        mock_connect = MagicMock()
        mock_connect.list_instance_storage_configs.return_value = {
            'StorageConfigs': []
        }
        
        result = _discover_contact_lens_stream(mock_connect, 'test-instance-id')
        
        assert result is None

    @patch('boto3.client')
    def test_discover_streams_with_multiple_configs(self, mock_boto3_client):
        """Test stream discovery with multiple storage configurations"""
        mock_connect = MagicMock()
        mock_boto3_client.return_value = mock_connect
        
        # Mock response with multiple configs, only one Kinesis
        mock_connect.list_instance_storage_configs.side_effect = [
            {
                'StorageConfigs': [
                    {
                        'StorageType': 'S3',
                        'S3Config': {'BucketName': 'test-bucket'}
                    },
                    {
                        'StorageType': 'KINESIS_STREAM',
                        'KinesisStreamConfig': {
                            'StreamArn': 'arn:aws:kinesis:us-west-2:123456789012:stream/ctr-stream'
                        }
                    }
                ]
            },
            {
                'StorageConfigs': [{
                    'StorageType': 'KINESIS_STREAM',
                    'KinesisStreamConfig': {
                        'StreamArn': 'arn:aws:kinesis:us-west-2:123456789012:stream/contact-lens-stream'
                    }
                }]
            }
        ]
        
        result = discover_connect_streams('test-instance-id')
        
        assert result['ctr_stream_arn'] == 'arn:aws:kinesis:us-west-2:123456789012:stream/ctr-stream'
        assert result['contact_lens_stream_arn'] == 'arn:aws:kinesis:us-west-2:123456789012:stream/contact-lens-stream'

    @patch('boto3.client')
    def test_discover_streams_client_error_handling(self, mock_boto3_client):
        """Test proper error handling for various client errors"""
        mock_connect = MagicMock()
        mock_boto3_client.return_value = mock_connect
        
        # Test different error scenarios - function handles errors gracefully
        error_scenarios = [
            ('ResourceNotFoundException', 'Resource not found'),
            ('InvalidParameterException', 'Invalid parameter'),
            ('ThrottlingException', 'Request throttled')
        ]
        
        for error_code, error_message in error_scenarios:
            mock_connect.list_instance_storage_configs.side_effect = ClientError(
                {'Error': {'Code': error_code, 'Message': error_message}},
                'ListInstanceStorageConfigs'
            )
            
            result = discover_connect_streams('test-instance-id')
            
            # Function handles errors gracefully and returns None values
            assert result['ctr_stream_arn'] is None
            assert result['contact_lens_stream_arn'] is None

    @patch('boto3.client')
    def test_discover_streams_unexpected_error(self, mock_boto3_client):
        """Test handling of unexpected errors"""
        mock_connect = MagicMock()
        mock_boto3_client.return_value = mock_connect
        
        # Mock unexpected exception
        mock_connect.list_instance_storage_configs.side_effect = Exception("Unexpected error")
        
        # Function handles unexpected errors gracefully
        result = discover_connect_streams('test-instance-id')
        
        assert result['ctr_stream_arn'] is None
        assert result['contact_lens_stream_arn'] is None

    @patch('boto3.client')
    def test_discover_streams_default_region(self, mock_boto3_client):
        """Test stream discovery with default region (None)"""
        mock_connect = MagicMock()
        mock_boto3_client.return_value = mock_connect
        
        mock_connect.list_instance_storage_configs.return_value = {
            'StorageConfigs': []
        }
        
        result = discover_connect_streams('test-instance-id', region=None)
        
        # Verify client was created with connect service
        mock_boto3_client.assert_called_with('connect')
        assert result['ctr_stream_arn'] is None
        assert result['contact_lens_stream_arn'] is None

    def test_discover_ctr_stream_no_configs(self):
        """Test _discover_ctr_stream with no storage configs."""
        mock_connect_client = MagicMock()
        mock_connect_client.list_instance_storage_configs.return_value = {
            'StorageConfigs': []
        }
        
        result = _discover_ctr_stream(mock_connect_client, "test-instance")
        
        assert result is None

    def test_discover_contact_lens_stream_no_configs(self):
        """Test _discover_contact_lens_stream with no storage configs."""
        mock_connect_client = MagicMock()
        mock_connect_client.list_instance_storage_configs.return_value = {
            'StorageConfigs': []
        }
        
        result = _discover_contact_lens_stream(mock_connect_client, "test-instance")
        
        assert result is None
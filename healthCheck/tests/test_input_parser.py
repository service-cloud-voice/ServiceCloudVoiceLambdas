"""
Tests for input parameter parsing functionality
"""

import pytest
import os
from unittest.mock import patch, MagicMock

# Import the module under test
import sys
sys.path.insert(0, '/Users/tkuwar/opt/workspace/aws-integration/lambdas/healthCheck')

from models.input_parser import parse_input_parameters
from models.health_models import HealthCheckInput


class TestInputParser:
    """Test cases for input parameter parsing"""

    @patch.dict(os.environ, {
        'VERSION': '19.0',
        'CALL_CENTER_API_NAME': 'ServiceCloudVoice',
        'SKU': 'RESELL',
        'CONNECT_INSTANCE_ID': '12345678-1234-1234-1234-123456789012',
        'S3_BUCKET_FOR_TENANT_RESOURCES': 'tenant-resources-bucket',
        'S3_BUCKET_FOR_REPORTS': 'reports-bucket',
        'AWS_REGION': 'us-west-2'
    })
    @patch('boto3.client')
    def test_parse_valid_input_all_fields(self, mock_boto3_client):
        """Test parsing valid input with all environment variables set"""
        # Mock STS client
        mock_sts = MagicMock()
        mock_sts.get_caller_identity.return_value = {
            "Account": "123456789012"
        }
        mock_boto3_client.return_value = mock_sts
        
        event = {
            "execution_id": "exec-123-456",
            "max_threads": 5,
            "include_detailed_errors": False
        }
        
        result = parse_input_parameters(event)
        
        assert isinstance(result, HealthCheckInput)
        assert result.cc_version == "19.0"
        assert result.cc_name == "ServiceCloudVoice"
        assert result.sku == "resell"  # Should be lowercase
        assert result.execution_id == "exec-123-456"
        assert result.region == "us-west-2"
        assert result.connect_instance_id == "12345678-1234-1234-1234-123456789012"
        assert result.s3_bucket_for_tenant_resources == "tenant-resources-bucket"
        assert result.s3_bucket_for_reports == "reports-bucket"
        assert result.connect_instance_arn == "arn:aws:connect:us-west-2:123456789012:instance/12345678-1234-1234-1234-123456789012"
        assert result.account_id == "123456789012"
        assert result.partition == "aws"
        assert result.max_threads == 5
        assert result.include_detailed_errors == False

    @patch.dict(os.environ, {
        'VERSION': '19.0',
        'CALL_CENTER_API_NAME': 'ServiceCloudVoice',
        'SKU': 'RESELL',
        'CONNECT_INSTANCE_ID': '12345678-1234-1234-1234-123456789012',
        'S3_BUCKET_FOR_TENANT_RESOURCES': 'tenant-resources-bucket',
        'S3_BUCKET_FOR_REPORTS': 'reports-bucket',
        'AWS_REGION': 'us-west-2'
    })
    @patch('boto3.client')
    def test_parse_valid_input_minimal_fields(self, mock_boto3_client):
        """Test parsing valid input with minimal event (generated execution_id)"""
        # Mock STS client
        mock_sts = MagicMock()
        mock_sts.get_caller_identity.return_value = {
            "Account": "123456789012"
        }
        mock_boto3_client.return_value = mock_sts
        
        event = {}  # Empty event - all config from environment variables
        
        result = parse_input_parameters(event)
        
        assert isinstance(result, HealthCheckInput)
        assert result.cc_version == "19.0"
        assert result.cc_name == "ServiceCloudVoice"
        assert result.sku == "resell"
        assert result.execution_id is not None  # Generated
        assert result.execution_id.startswith("hc-")
        assert result.region == "us-west-2"
        assert result.connect_instance_id == "12345678-1234-1234-1234-123456789012"
        assert result.s3_bucket_for_tenant_resources == "tenant-resources-bucket"
        assert result.s3_bucket_for_reports == "reports-bucket"
        # Check defaults
        assert result.max_threads == 10
        assert result.include_detailed_errors == True

    @patch.dict(os.environ, {
        'VERSION': '19.0',
        'CALL_CENTER_API_NAME': 'ServiceCloudVoice',
        'SKU': 'BYOA',
        'CONNECT_INSTANCE_ID': '12345678-1234-1234-1234-123456789012',
        'S3_BUCKET_FOR_TENANT_RESOURCES': 'tenant-resources-bucket',
        'S3_BUCKET_FOR_REPORTS': 'reports-bucket',
        'AWS_REGION': 'us-west-2'
    })
    @patch('boto3.client')
    def test_parse_input_different_sku_types(self, mock_boto3_client):
        """Test parsing input with different SKU types"""
        # Mock STS client
        mock_sts = MagicMock()
        mock_sts.get_caller_identity.return_value = {
            "Account": "123456789012"
        }
        mock_boto3_client.return_value = mock_sts
        
        event = {"execution_id": "exec-123-456"}
        
        result = parse_input_parameters(event)
        
        assert result.sku == "byoa"  # Should be lowercase
        assert result.cc_version == "19.0"
        assert result.cc_name == "ServiceCloudVoice"

    @patch.dict(os.environ, {
        'VERSION': '19.0',
        'CALL_CENTER_API_NAME': 'ServiceCloudVoice',
        'SKU': 'ENTERPRISE',
        'CONNECT_INSTANCE_ID': '12345678-1234-1234-1234-123456789012',
        'S3_BUCKET_FOR_TENANT_RESOURCES': 'tenant-resources-bucket',
        'AWS_REGION': 'cn-north-1'  # China region
    })
    @patch('boto3.client')
    def test_parse_input_china_region(self, mock_boto3_client):
        """Test parsing input with China region (different partition)"""
        # Mock STS client
        mock_sts = MagicMock()
        mock_sts.get_caller_identity.return_value = {
            "Account": "123456789012"
        }
        mock_boto3_client.return_value = mock_sts
        
        event = {}
        
        result = parse_input_parameters(event)
        
        assert result.sku == "enterprise"
        assert result.region == "cn-north-1"
        assert result.partition == "aws-cn"
        assert "arn:aws-cn:connect:cn-north-1" in result.connect_instance_arn

    @patch.dict(os.environ, {
        'VERSION': '19.0',
        'CALL_CENTER_API_NAME': 'ServiceCloudVoice',
        'SKU': 'RESELL',
        'CONNECT_INSTANCE_ID': '12345678-1234-1234-1234-123456789012',
        'S3_BUCKET_FOR_TENANT_RESOURCES': 'tenant-resources-bucket',
        'AWS_REGION': 'us-gov-west-1'  # GovCloud region
    })
    @patch('boto3.client')
    def test_parse_input_govcloud_region(self, mock_boto3_client):
        """Test parsing input with GovCloud region (different partition)"""
        # Mock STS client
        mock_sts = MagicMock()
        mock_sts.get_caller_identity.return_value = {
            "Account": "123456789012"
        }
        mock_boto3_client.return_value = mock_sts
        
        event = {}
        
        result = parse_input_parameters(event)
        
        assert result.region == "us-gov-west-1"
        assert result.partition == "aws-us-gov"
        assert "arn:aws-us-gov:connect:us-gov-west-1" in result.connect_instance_arn

    @patch.dict(os.environ, {
        'VERSION': '19.0',
        'CALL_CENTER_API_NAME': 'ServiceCloudVoice',
        # Missing SKU
        'CONNECT_INSTANCE_ID': '12345678-1234-1234-1234-123456789012',
        'S3_BUCKET_FOR_TENANT_RESOURCES': 'tenant-resources-bucket',
        'S3_BUCKET_FOR_REPORTS': 'reports-bucket',
        'AWS_REGION': 'us-west-2'
    })
    @patch('boto3.client')
    def test_parse_input_missing_required_env_var(self, mock_boto3_client):
        """Test parsing input with missing required environment variable raises ValueError"""
        # Mock STS client
        mock_sts = MagicMock()
        mock_sts.get_caller_identity.return_value = {
            "Account": "123456789012"
        }
        mock_boto3_client.return_value = mock_sts
        
        event = {}
        
        with pytest.raises(ValueError) as exc_info:
            parse_input_parameters(event)
        
        error_msg = str(exc_info.value)
        assert "Missing required environment variables:" in error_msg
        assert "sku (requires SKU environment variable)" in error_msg

    @patch.dict(os.environ, {
        'VERSION': '19.0',
        # Missing multiple required env vars
        'AWS_REGION': 'us-west-2'
    })
    def test_parse_input_multiple_missing_env_vars(self):
        """Test parsing input with multiple missing required environment variables"""
        event = {}
        
        with pytest.raises(ValueError) as exc_info:
            parse_input_parameters(event)
        
        error_msg = str(exc_info.value)
        assert "Missing required environment variables:" in error_msg
        assert "cc_name (requires CALL_CENTER_API_NAME environment variable)" in error_msg
        assert "sku (requires SKU environment variable)" in error_msg
        assert "connect_instance_arn (requires CONNECT_INSTANCE_ID (to build ARN) environment variable)" in error_msg

    @patch.dict(os.environ, {}, clear=True)
    def test_parse_input_no_env_vars(self):
        """Test parsing with no environment variables raises ValueError"""
        event = {}
        
        with pytest.raises(ValueError) as exc_info:
            parse_input_parameters(event)
        
        error_msg = str(exc_info.value)
        assert "Missing required environment variables:" in error_msg

    @patch.dict(os.environ, {
        'VERSION': '19.0',
        'CALL_CENTER_API_NAME': 'ServiceCloudVoice',
        'SKU': 'RESELL',
        'CONNECT_INSTANCE_ID': '12345678-1234-1234-1234-123456789012',
        'S3_BUCKET_FOR_TENANT_RESOURCES': 'tenant-resources-bucket',
        'S3_BUCKET_FOR_REPORTS': 'reports-bucket',
        'AWS_REGION': 'us-west-2'
    })
    @patch('boto3.client')
    @patch('utils.logging_utils.fail')
    def test_parse_input_sts_exception_handling(self, mock_fail, mock_boto3_client):
        """Test exception handling when STS fails"""
        # Mock STS failure
        mock_sts = MagicMock()
        mock_sts.get_caller_identity.side_effect = Exception("STS call failed")
        mock_boto3_client.return_value = mock_sts
        
        event = {}
        
        with pytest.raises(ValueError) as exc_info:
            parse_input_parameters(event)
        
        # Verify error message contains expected text
        error_msg = str(exc_info.value)
        assert "Failed to parse input parameters:" in error_msg

    @patch.dict(os.environ, {
        'VERSION': '19.0',
        'CALL_CENTER_API_NAME': 'ServiceCloudVoice',
        'SKU': 'RESELL',
        'CONNECT_INSTANCE_ID': 'invalid-instance-id',  # Invalid format
        'S3_BUCKET_FOR_TENANT_RESOURCES': 'tenant-resources-bucket',
        'S3_BUCKET_FOR_REPORTS': 'reports-bucket',
        'AWS_REGION': 'us-west-2'
    })
    @patch('boto3.client')
    def test_parse_input_invalid_arn_format(self, mock_boto3_client):
        """Test parsing input with invalid Connect instance ID format"""
        # Mock STS client
        mock_sts = MagicMock()
        mock_sts.get_caller_identity.return_value = {
            "Account": "123456789012"
        }
        mock_boto3_client.return_value = mock_sts
        
        event = {}
        
        with pytest.raises(ValueError) as exc_info:
            parse_input_parameters(event)
        
        error_msg = str(exc_info.value)
        assert "Invalid connect_instance_arn:" in error_msg
"""
Tests for S3 utility functions
"""

import pytest
import json
from unittest.mock import patch, MagicMock
from botocore.exceptions import ClientError

# Import the module under test
import sys
sys.path.insert(0, '/Users/tkuwar/opt/workspace/aws-integration/lambdas/healthCheck')

from utils.s3_utils import upload_report_to_s3, ensure_lifecycle_policy
from models.health_models import HealthCheckInput


class TestUploadReportToS3:
    """Test cases for upload_report_to_s3 function"""

    @patch('utils.s3_utils.ensure_lifecycle_policy')
    @patch('utils.s3_utils.boto3.client')
    def test_upload_report_to_s3_success(self, mock_boto3_client, mock_ensure_lifecycle):
        """Test successful S3 report upload"""
        # Mock S3 client
        mock_s3_client = MagicMock()
        mock_boto3_client.return_value = mock_s3_client

        # Mock health input
        health_input = HealthCheckInput(
            cc_version="19.0",
            cc_name="ServiceCloudVoice",
            sku="resell",
            connect_instance_arn="arn:aws:connect:us-west-2:123456789012:instance/12345678-1234-1234-1234-123456789012",
            region="us-west-2",
            s3_bucket_for_tenant_resources="tenant-bucket",
            s3_bucket_for_reports="test-bucket"
        )

        # Test report
        report = {
            "summary": {
                "overall_status": "HEALTHY",
                "total_resources": 5,
                "healthy": 5
            },
            "execution_id": "exec-123-456"
        }

        execution_id = "exec-123-456"

        # Execute
        result = upload_report_to_s3(health_input, report, execution_id)

        # Verify
        assert result == "s3://test-bucket/health_report/exec-123-456.json"
        mock_ensure_lifecycle.assert_called_once_with(mock_s3_client, "test-bucket")
        mock_s3_client.put_object.assert_called_once()
        
        # Verify put_object call arguments
        call_args = mock_s3_client.put_object.call_args
        assert call_args[1]['Bucket'] == "test-bucket"
        assert call_args[1]['Key'] == "health_report/exec-123-456.json"
        assert call_args[1]['ContentType'] == "application/json"
        assert 'execution-id' in call_args[1]['Metadata']

    @patch('utils.s3_utils.ensure_lifecycle_policy')
    @patch('utils.s3_utils.boto3.client')
    def test_upload_report_to_s3_with_none_values(self, mock_boto3_client, mock_ensure_lifecycle):
        """Test S3 report upload with None values in metadata"""
        # Mock S3 client
        mock_s3_client = MagicMock()
        mock_boto3_client.return_value = mock_s3_client

        # Mock health input with None values
        health_input = HealthCheckInput(
            cc_version=None,  # None value
            cc_name=None,     # None value
            sku="resell",
            connect_instance_arn="arn:aws:connect:us-west-2:123456789012:instance/12345678-1234-1234-1234-123456789012",
            region="us-west-2",
            s3_bucket_for_tenant_resources="tenant-bucket",
            s3_bucket_for_reports="test-bucket"
        )

        # Test report
        report = {
            "summary": {
                "overall_status": "HEALTHY",
                "total_resources": 0,
                "healthy": 0
            }
        }

        execution_id = "exec-123-456"

        # Execute
        result = upload_report_to_s3(health_input, report, execution_id)

        # Verify
        assert result == "s3://test-bucket/health_report/exec-123-456.json"
        
        # Verify metadata handling of None values
        call_args = mock_s3_client.put_object.call_args
        metadata = call_args[1]['Metadata']
        assert metadata['cc-version'] == ""  # None converted to empty string
        assert metadata['cc-name'] == ""     # None converted to empty string

    @patch('utils.s3_utils.ensure_lifecycle_policy')
    @patch('utils.s3_utils.boto3.client')
    def test_upload_report_to_s3_put_object_failure(self, mock_boto3_client, mock_ensure_lifecycle):
        """Test S3 report upload when put_object fails"""
        # Mock S3 client with put_object failure
        mock_s3_client = MagicMock()
        mock_s3_client.put_object.side_effect = ClientError(
            {'Error': {'Code': 'AccessDenied', 'Message': 'Access denied'}},
            'PutObject'
        )
        mock_boto3_client.return_value = mock_s3_client

        # Mock health input
        health_input = HealthCheckInput(
            cc_version="19.0",
            cc_name="ServiceCloudVoice",
            sku="resell",
            connect_instance_arn="arn:aws:connect:us-west-2:123456789012:instance/12345678-1234-1234-1234-123456789012",
            region="us-west-2",
            s3_bucket_for_tenant_resources="tenant-bucket",
            s3_bucket_for_reports="test-bucket"
        )

        report = {"summary": {"overall_status": "HEALTHY"}}
        execution_id = "exec-123-456"

        # Execute
        result = upload_report_to_s3(health_input, report, execution_id)

        # Verify failure
        assert result is None

    @patch('utils.s3_utils.ensure_lifecycle_policy')
    @patch('utils.s3_utils.boto3.client')
    def test_upload_report_to_s3_ensure_lifecycle_failure(self, mock_boto3_client, mock_ensure_lifecycle):
        """Test S3 report upload when ensure_lifecycle_policy fails"""
        # Mock S3 client
        mock_s3_client = MagicMock()
        mock_boto3_client.return_value = mock_s3_client
        
        # Mock ensure_lifecycle_policy failure
        mock_ensure_lifecycle.side_effect = Exception("Lifecycle policy error")

        # Mock health input
        health_input = HealthCheckInput(
            cc_version="19.0",
            cc_name="ServiceCloudVoice",
            sku="resell",
            connect_instance_arn="arn:aws:connect:us-west-2:123456789012:instance/12345678-1234-1234-1234-123456789012",
            region="us-west-2",
            s3_bucket_for_tenant_resources="tenant-bucket",
            s3_bucket_for_reports="test-bucket"
        )

        report = {"summary": {"overall_status": "HEALTHY"}}
        execution_id = "exec-123-456"

        # Execute
        result = upload_report_to_s3(health_input, report, execution_id)

        # Verify failure
        assert result is None

    @patch('utils.s3_utils.ensure_lifecycle_policy')
    @patch('utils.s3_utils.boto3.client')
    def test_upload_report_to_s3_json_encoding(self, mock_boto3_client, mock_ensure_lifecycle):
        """Test S3 report upload with complex JSON data"""
        # Mock S3 client
        mock_s3_client = MagicMock()
        mock_boto3_client.return_value = mock_s3_client

        # Mock health input
        health_input = HealthCheckInput(
            cc_version="19.0",
            cc_name="ServiceCloudVoice",
            sku="resell",
            connect_instance_arn="arn:aws:connect:us-west-2:123456789012:instance/12345678-1234-1234-1234-123456789012",
            region="us-west-2",
            s3_bucket_for_tenant_resources="tenant-bucket",
            s3_bucket_for_reports="test-bucket"
        )

        # Complex test report
        report = {
            "summary": {
                "overall_status": "HEALTHY",
                "total_resources": 3,
                "healthy": 2,
                "unhealthy": 1
            },
            "details": [
                {"resource": "Lambda1", "status": "HEALTHY"},
                {"resource": "Lambda2", "status": "UNHEALTHY", "error": "Function not found"}
            ],
            "timestamp": "2023-12-01T10:00:00Z"
        }

        execution_id = "exec-123-456"

        # Execute
        result = upload_report_to_s3(health_input, report, execution_id)

        # Verify
        assert result == "s3://test-bucket/health_report/exec-123-456.json"
        
        # Verify JSON content was properly encoded
        call_args = mock_s3_client.put_object.call_args
        body = call_args[1]['Body']
        assert isinstance(body, bytes)  # Should be encoded as bytes


class TestEnsureLifecyclePolicy:
    """Test cases for ensure_lifecycle_policy function"""

    def test_ensure_lifecycle_policy_success(self):
        """Test successful lifecycle policy creation"""
        # Mock S3 client
        mock_s3_client = MagicMock()
        
        # Mock get_bucket_lifecycle_configuration to return no existing policy
        mock_s3_client.get_bucket_lifecycle_configuration.side_effect = ClientError(
            {'Error': {'Code': 'NoSuchLifecycleConfiguration'}},
            'GetBucketLifecycleConfiguration'
        )

        bucket_name = "test-bucket"

        # Execute
        ensure_lifecycle_policy(mock_s3_client, bucket_name)

        # Verify
        mock_s3_client.get_bucket_lifecycle_configuration.assert_called_once_with(Bucket=bucket_name)
        mock_s3_client.put_bucket_lifecycle_configuration.assert_called_once()
        
        # Verify lifecycle policy structure
        call_args = mock_s3_client.put_bucket_lifecycle_configuration.call_args
        lifecycle_config = call_args[1]['LifecycleConfiguration']
        assert 'Rules' in lifecycle_config
        assert len(lifecycle_config['Rules']) == 1
        assert lifecycle_config['Rules'][0]['Filter']['Prefix'] == 'health_report/'
        assert lifecycle_config['Rules'][0]['Expiration']['Days'] == 1

    def test_ensure_lifecycle_policy_already_exists(self):
        """Test lifecycle policy when it already exists"""
        # Mock S3 client
        mock_s3_client = MagicMock()
        
        # Mock existing lifecycle policy
        existing_policy = {
            'Rules': [
                {
                    'ID': 'health_report_cleanup',
                    'Status': 'Enabled',
                    'Filter': {'Prefix': 'health_report/'},
                    'Expiration': {'Days': 1}
                }
            ]
        }
        mock_s3_client.get_bucket_lifecycle_configuration.return_value = existing_policy

        bucket_name = "test-bucket"

        # Execute
        ensure_lifecycle_policy(mock_s3_client, bucket_name)

        # Verify - should not create new policy
        mock_s3_client.get_bucket_lifecycle_configuration.assert_called_once_with(Bucket=bucket_name)
        mock_s3_client.put_bucket_lifecycle_configuration.assert_not_called()

    def test_ensure_lifecycle_policy_different_existing_rules(self):
        """Test lifecycle policy when different rules exist"""
        # Mock S3 client
        mock_s3_client = MagicMock()
        
        # Mock existing lifecycle policy with different rules
        existing_policy = {
            'Rules': [
                {
                    'ID': 'other_cleanup',
                    'Status': 'Enabled',
                    'Filter': {'Prefix': 'logs/'},
                    'Expiration': {'Days': 30}
                }
            ]
        }
        mock_s3_client.get_bucket_lifecycle_configuration.return_value = existing_policy

        bucket_name = "test-bucket"

        # Execute
        ensure_lifecycle_policy(mock_s3_client, bucket_name)

        # Verify - should add new rule
        mock_s3_client.get_bucket_lifecycle_configuration.assert_called_once_with(Bucket=bucket_name)
        mock_s3_client.put_bucket_lifecycle_configuration.assert_called_once()
        
        # Verify both rules are present
        call_args = mock_s3_client.put_bucket_lifecycle_configuration.call_args
        lifecycle_config = call_args[1]['LifecycleConfiguration']
        assert len(lifecycle_config['Rules']) == 2

    def test_ensure_lifecycle_policy_access_denied(self):
        """Test lifecycle policy creation with access denied"""
        # Mock S3 client
        mock_s3_client = MagicMock()
        
        # Mock access denied error
        mock_s3_client.get_bucket_lifecycle_configuration.side_effect = ClientError(
            {'Error': {'Code': 'AccessDenied', 'Message': 'Access denied'}},
            'GetBucketLifecycleConfiguration'
        )

        bucket_name = "test-bucket"

        # Execute - should not raise exception
        ensure_lifecycle_policy(mock_s3_client, bucket_name)

        # Verify - should not attempt to create policy
        mock_s3_client.get_bucket_lifecycle_configuration.assert_called_once_with(Bucket=bucket_name)
        mock_s3_client.put_bucket_lifecycle_configuration.assert_not_called()

    def test_ensure_lifecycle_policy_put_failure(self):
        """Test lifecycle policy creation when put operation fails"""
        # Mock S3 client
        mock_s3_client = MagicMock()
        
        # Mock no existing policy
        mock_s3_client.get_bucket_lifecycle_configuration.side_effect = ClientError(
            {'Error': {'Code': 'NoSuchLifecycleConfiguration'}},
            'GetBucketLifecycleConfiguration'
        )
        
        # Mock put operation failure
        mock_s3_client.put_bucket_lifecycle_configuration.side_effect = ClientError(
            {'Error': {'Code': 'AccessDenied', 'Message': 'Access denied'}},
            'PutBucketLifecycleConfiguration'
        )

        bucket_name = "test-bucket"

        # Execute - should not raise exception
        ensure_lifecycle_policy(mock_s3_client, bucket_name)

        # Verify both operations were attempted
        mock_s3_client.get_bucket_lifecycle_configuration.assert_called_once_with(Bucket=bucket_name)
        mock_s3_client.put_bucket_lifecycle_configuration.assert_called_once()
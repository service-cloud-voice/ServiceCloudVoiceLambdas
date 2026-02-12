"""
Tests for the main lambda handler function
"""

import pytest
import json
import os
from unittest.mock import patch, MagicMock

# Import the module under test
import sys
sys.path.insert(0, '/Users/tkuwar/opt/workspace/aws-integration/lambdas/healthCheck')

from healthcheck import lambda_handler


class TestLambdaHandler:
    """Test cases for the main lambda_handler function"""

    @patch('healthcheck.setup_logging')
    @patch('healthcheck.get_logger')
    @patch('healthcheck.upload_report_to_s3')
    @patch('healthcheck.generate_enhanced_report')
    @patch('healthcheck.MultiThreadedValidator')
    @patch('healthcheck.replace_placeholders')
    @patch('healthcheck.load_expected_from_layer')
    @patch('healthcheck.parse_input_parameters')
    def test_lambda_handler_success(self, mock_parse_input, mock_load_config, 
                                   mock_replace_placeholders, mock_validator_class, 
                                   mock_generate_report, mock_upload_s3, 
                                   mock_get_logger, mock_setup_logging):
        """Test successful lambda handler execution"""
        
        # Mock logger
        mock_logger = MagicMock()
        mock_get_logger.return_value = mock_logger
        
        # Mock parsed input
        mock_health_input = MagicMock()
        mock_health_input.execution_id = "exec-123-456"
        mock_health_input.cc_version = "19.0"
        mock_health_input.sku = "resell"
        mock_health_input.cc_name = "ServiceCloudVoice"
        mock_health_input.region = "us-west-2"
        mock_health_input.connect_instance_id = "12345678-1234-1234-1234-123456789012"
        mock_health_input.account_id = "123456789012"
        mock_health_input.partition = "aws"
        mock_health_input.call_center_api_name = "ServiceCloudVoice"
        mock_health_input.s3_bucket_for_tenant_resources = "tenant-bucket"
        mock_health_input.lambda_prefix = "MyOrg"
        mock_health_input.include_detailed_errors = True
        mock_parse_input.return_value = mock_health_input
        
        # Mock configuration loading
        mock_config_raw = {"LambdaFunctions": [{"name": "TestFunction"}]}
        mock_load_config.return_value = mock_config_raw
        
        mock_config_processed = {"LambdaFunctions": [{"name": "MyOrgTestFunction"}]}
        mock_replace_placeholders.return_value = mock_config_processed
        
        # Mock validator
        mock_validator = MagicMock()
        mock_full_report = [{"ResourceType": "Test", "DetailedHealthCheck": []}]
        mock_validator.validate_all_resources_parallel.return_value = mock_full_report
        mock_validator.errors = []
        mock_validator_class.return_value = mock_validator
        
        # Mock enhanced report
        mock_enhanced_report = {
            "summary": {
                "overall_status": "HEALTHY",
                "total_resources": 1,
                "healthy": 1,
                "unhealthy": 0,
                "error_count": 0
            }
        }
        mock_generate_report.return_value = mock_enhanced_report
        
        # Mock S3 upload
        mock_upload_s3.return_value = "s3://tenant-bucket/health_report/exec-123-456.json"
        
        # Test event (minimal since all config comes from env vars)
        event = {
            "execution_id": "exec-123-456",
            "include_detailed_errors": True
        }
        
        context = MagicMock()
        
        # Execute
        result = lambda_handler(event, context)
        
        # Verify response
        assert result["statusCode"] == 200
        assert result["headers"]["Content-Type"] == "application/json"
        assert result["headers"]["X-Execution-ID"] == "exec-123-456"
        
        body = json.loads(result["body"])
        assert body["execution_id"] == "exec-123-456"
        assert body["overall_status"] == "HEALTHY"
        assert body["summary"]["total_resources"] == 1
        assert "s3_report" in body
        assert body["s3_report"]["status"] == "uploaded"
        assert body["s3_report"]["url"] == "s3://tenant-bucket/health_report/exec-123-456.json"
        assert "detailed_results" in body
        assert "errors" in body

    @patch('healthcheck.setup_logging')
    @patch('healthcheck.get_logger')
    @patch('healthcheck.is_debug_enabled')
    @patch('healthcheck.upload_report_to_s3')
    @patch('healthcheck.generate_enhanced_report')
    @patch('healthcheck.MultiThreadedValidator')
    @patch('healthcheck.replace_placeholders')
    @patch('healthcheck.load_expected_from_layer')
    @patch('healthcheck.parse_input_parameters')
    def test_lambda_handler_with_debug_enabled(self, mock_parse_input, mock_load_config, 
                                              mock_replace_placeholders, mock_validator_class, 
                                              mock_generate_report, mock_upload_s3, 
                                              mock_is_debug_enabled, mock_get_logger, 
                                              mock_setup_logging):
        """Test lambda handler with debug mode enabled"""
        
        # Enable debug mode
        mock_is_debug_enabled.return_value = True
        
        # Mock logger
        mock_logger = MagicMock()
        mock_get_logger.return_value = mock_logger
        
        # Setup mocks (similar to previous test)
        mock_health_input = MagicMock()
        mock_health_input.execution_id = "exec-123-456"
        mock_health_input.cc_version = "19.0"
        mock_health_input.sku = "resell"
        mock_health_input.region = "us-west-2"
        mock_health_input.account_id = "123456789012"
        mock_health_input.partition = "aws"
        mock_health_input.connect_instance_id = "12345678-1234-1234-1234-123456789012"
        mock_health_input.call_center_api_name = "ServiceCloudVoice"
        mock_health_input.s3_bucket_for_tenant_resources = "tenant-bucket"
        mock_health_input.lambda_prefix = "MyOrg"
        mock_health_input.include_detailed_errors = True
        mock_parse_input.return_value = mock_health_input
        
        mock_load_config.return_value = {"LambdaFunctions": []}
        mock_replace_placeholders.return_value = {"LambdaFunctions": []}
        
        mock_validator = MagicMock()
        mock_validator.validate_all_resources_parallel.return_value = []
        mock_validator.errors = []
        mock_validator_class.return_value = mock_validator
        
        mock_enhanced_report = {
            "summary": {
                "overall_status": "HEALTHY",
                "total_resources": 0,
                "healthy": 0,
                "unhealthy": 0,
                "error_count": 0
            }
        }
        mock_generate_report.return_value = mock_enhanced_report
        mock_upload_s3.return_value = "s3://bucket/file.json"
        
        event = {}  # Empty event since all config from env vars
        
        result = lambda_handler(event, MagicMock())
        
        # Verify execution time is included when debug is enabled
        body = json.loads(result["body"])
        assert "execution_time_ms" in body

    @patch('healthcheck.setup_logging')
    @patch('healthcheck.get_logger')
    @patch('healthcheck.fail')
    @patch('healthcheck.parse_input_parameters')
    def test_lambda_handler_parse_error(self, mock_parse_input, mock_fail, 
                                       mock_get_logger, mock_setup_logging):
        """Test lambda handler with input parsing error"""
        
        # Mock logger
        mock_logger = MagicMock()
        mock_get_logger.return_value = mock_logger
        
        # Mock parsing failure
        mock_parse_input.side_effect = ValueError("Missing required environment variables: sku (requires SKU environment variable)")
        
        event = {}
        context = MagicMock()
        
        result = lambda_handler(event, context)
        
        # Verify error response
        assert result["statusCode"] == 500
        assert result["headers"]["Content-Type"] == "application/json"
        
        body = json.loads(result["body"])
        assert "error" in body
        assert "Health check failed:" in body["error"]
        assert "execution_id" in body

    @patch('healthcheck.setup_logging')
    @patch('healthcheck.get_logger')
    @patch('healthcheck.upload_report_to_s3')
    @patch('healthcheck.generate_enhanced_report')
    @patch('healthcheck.MultiThreadedValidator')
    @patch('healthcheck.replace_placeholders')
    @patch('healthcheck.load_expected_from_layer')
    @patch('healthcheck.parse_input_parameters')
    def test_lambda_handler_s3_upload_failure(self, mock_parse_input, mock_load_config,
                                             mock_replace_placeholders, mock_validator_class,
                                             mock_generate_report, mock_upload_s3,
                                             mock_get_logger, mock_setup_logging):
        """Test lambda handler when S3 upload fails"""
        
        # Mock logger
        mock_logger = MagicMock()
        mock_get_logger.return_value = mock_logger
        
        # Setup successful mocks except S3 upload
        mock_health_input = MagicMock()
        mock_health_input.execution_id = "exec-123-456"
        mock_health_input.cc_version = "19.0"
        mock_health_input.sku = "resell"
        mock_health_input.region = "us-west-2"
        mock_health_input.account_id = "123456789012"
        mock_health_input.partition = "aws"
        mock_health_input.connect_instance_id = "12345678-1234-1234-1234-123456789012"
        mock_health_input.call_center_api_name = "ServiceCloudVoice"
        mock_health_input.s3_bucket_for_tenant_resources = "tenant-bucket"
        mock_health_input.lambda_prefix = "MyOrg"
        mock_health_input.include_detailed_errors = True
        mock_parse_input.return_value = mock_health_input
        
        mock_load_config.return_value = {"LambdaFunctions": []}
        mock_replace_placeholders.return_value = {"LambdaFunctions": []}
        
        mock_validator = MagicMock()
        mock_validator.validate_all_resources_parallel.return_value = []
        mock_validator.errors = []
        mock_validator_class.return_value = mock_validator
        
        mock_enhanced_report = {
            "summary": {
                "overall_status": "HEALTHY",
                "total_resources": 0,
                "healthy": 0,
                "unhealthy": 0,
                "error_count": 0
            }
        }
        mock_generate_report.return_value = mock_enhanced_report
        
        # Mock S3 upload failure
        mock_upload_s3.return_value = None  # Indicates failure
        
        event = {}
        
        result = lambda_handler(event, MagicMock())
        
        # Should still return success but with S3 upload failure status
        assert result["statusCode"] == 200
        body = json.loads(result["body"])
        assert "s3_report" in body
        assert body["s3_report"]["status"] == "failed"
        assert "error" in body["s3_report"]

    @patch.dict(os.environ, {
        'VERSION': '19.0',
        'CALL_CENTER_API_NAME': 'TestCC',
        'SKU': 'BYOA',
        'CONNECT_INSTANCE_ID': '12345678-1234-1234-1234-123456789012',
        'S3_BUCKET_FOR_TENANT_RESOURCES': 'test-bucket',
        'AWS_REGION': 'us-west-2'
    })
    @patch('healthcheck.setup_logging')
    @patch('healthcheck.get_logger')
    @patch('healthcheck.parse_input_parameters')
    def test_lambda_handler_missing_arn_components(self, mock_parse_input_parameters, 
                                                 mock_get_logger, mock_setup_logging):
        """Test lambda_handler with missing ARN components."""
        # Mock logger
        mock_logger = MagicMock()
        mock_get_logger.return_value = mock_logger
        
        # Mock input parsing with missing partition
        mock_health_input = MagicMock()
        mock_health_input.execution_id = "test-exec-123"
        mock_health_input.account_id = "123456789012"
        mock_health_input.partition = None  # Missing partition
        mock_health_input.connect_instance_id = "test-instance"
        mock_parse_input_parameters.return_value = mock_health_input
        
        event = {"test": "event"}
        context = MagicMock()
        
        result = lambda_handler(event, context)
        
        # Should return error response
        assert result["statusCode"] == 500
        assert "Invalid ARN components extracted" in result["body"]

    @patch.dict(os.environ, {
        'VERSION': '19.0',
        'CALL_CENTER_API_NAME': 'TestCC',
        'SKU': 'BYOA',
        'CONNECT_INSTANCE_ID': '12345678-1234-1234-1234-123456789012',
        'S3_BUCKET_FOR_TENANT_RESOURCES': 'test-bucket',
        'AWS_REGION': 'us-west-2'
    })
    @patch('healthcheck.setup_logging')
    @patch('healthcheck.get_logger')
    @patch('healthcheck.parse_input_parameters')
    @patch('healthcheck.load_expected_from_layer')
    @patch('healthcheck.replace_placeholders')
    @patch('healthcheck.MultiThreadedValidator')
    @patch('healthcheck.generate_enhanced_report')
    @patch('healthcheck.upload_report_to_s3')
    @patch('healthcheck.is_debug_enabled')
    def test_lambda_handler_with_errors_and_debug(self, mock_is_debug_enabled, mock_upload_report_to_s3,
                                                mock_generate_enhanced_report, mock_multithreaded_validator,
                                                mock_replace_placeholders, mock_load_expected_from_layer,
                                                mock_parse_input_parameters, mock_get_logger, mock_setup_logging):
        """Test lambda_handler with errors and debug enabled."""
        # Mock logger
        mock_logger = MagicMock()
        mock_get_logger.return_value = mock_logger
        
        # Mock input parsing
        mock_health_input = MagicMock()
        mock_health_input.execution_id = "test-exec-123"
        mock_health_input.account_id = "123456789012"
        mock_health_input.partition = "aws"
        mock_health_input.connect_instance_id = "test-instance"
        mock_health_input.region = "us-west-2"
        mock_health_input.cc_version = "19.0"
        mock_health_input.cc_name = "TestCC"
        mock_health_input.sku = "byoa"
        mock_health_input.include_detailed_errors = True  # Include detailed errors
        mock_parse_input_parameters.return_value = mock_health_input
        
        # Mock configuration
        mock_cfg = {
            "LambdaFunctions": [{"name": "test-function"}]
        }
        mock_load_expected_from_layer.return_value = mock_cfg
        mock_replace_placeholders.return_value = mock_cfg
        
        # Mock validator with errors
        mock_validator_instance = MagicMock()
        mock_validator_instance.validate_all_resources_parallel.return_value = [{"test": "result"}]
        mock_validator_instance.errors = ["test error"]
        mock_multithreaded_validator.return_value = mock_validator_instance
        
        # Mock report with errors
        mock_generate_enhanced_report.return_value = {
            "summary": {
                "overall_status": "UNHEALTHY",
                "healthy": 5,
                "total_resources": 10,
                "unhealthy": 5,
                "error_count": 3  # This should trigger warning log
            }
        }
        mock_upload_report_to_s3.return_value = None  # S3 upload failure
        mock_is_debug_enabled.return_value = True  # Enable debug for execution time
        
        event = {"test": "event"}
        context = MagicMock()
        
        result = lambda_handler(event, context)
        
        # Verify warning was logged for error_count > 0
        mock_logger.warning.assert_called_with("Errors: 3")
        
        # Verify success with detailed results
        assert result["statusCode"] == 200
        body = eval(result["body"])  # Parse JSON string
        assert "detailed_results" in body
        assert "errors" in body
        assert body["s3_report"]["status"] == "failed"
        assert "execution_time_ms" in body  # Should include when debug enabled
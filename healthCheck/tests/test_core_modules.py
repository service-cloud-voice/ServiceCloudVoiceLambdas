"""
Tests for core modules (config, multithreading, reporting)
"""

import pytest
import json
from unittest.mock import patch, MagicMock, mock_open
from concurrent.futures import ThreadPoolExecutor

# Import the module under test
import sys
sys.path.insert(0, '/Users/tkuwar/opt/workspace/aws-integration/lambdas/healthCheck')

from core.config import load_expected_from_layer
from core.multithreading import MultiThreadedValidator
from core.reporting import generate_enhanced_report
from models.health_models import HealthCheckInput


class TestLoadExpectedFromLayer:
    """Test cases for load_expected_from_layer function"""

    @patch('builtins.open', new_callable=mock_open)
    def test_load_expected_from_layer_success(self, mock_file):
        """Test successful loading of expected resources from layer"""
        # Mock file content
        expected_config = {
            "LambdaFunctions": [
                {"name": "TestFunction", "alias": "active"}
            ],
            "IAMRoles": [
                {"name": "TestRole", "simulate_actions": ["s3:GetObject"]}
            ]
        }
        mock_file.return_value.read.return_value = json.dumps(expected_config)

        # Execute
        result = load_expected_from_layer("resell")

        # Verify
        assert result == expected_config
        mock_file.assert_called_once_with("/opt/expected_scv_resources_resell.json", encoding="utf-8")

    @patch('builtins.open', new_callable=mock_open)
    def test_load_expected_from_layer_file_not_found(self, mock_file):
        """Test loading expected resources when file not found"""
        # Mock file not found error
        mock_file.side_effect = FileNotFoundError("No such file or directory")

        # Execute and verify exception
        with pytest.raises(FileNotFoundError):
            load_expected_from_layer("byoa")

    @patch('builtins.open', new_callable=mock_open)
    def test_load_expected_from_layer_invalid_json(self, mock_file):
        """Test loading expected resources with invalid JSON"""
        # Mock invalid JSON content
        mock_file.return_value.read.return_value = "invalid json content"

        # Execute and verify exception
        with pytest.raises(json.JSONDecodeError):
            load_expected_from_layer("enterprise")

    @patch('builtins.open', new_callable=mock_open)
    def test_load_expected_from_layer_different_skus(self, mock_file):
        """Test loading expected resources for different SKU types"""
        # Mock file content
        expected_config = {"LambdaFunctions": []}
        mock_file.return_value.read.return_value = json.dumps(expected_config)

        # Test different SKU types
        skus = ["resell", "byoa", "enterprise"]
        for sku in skus:
            result = load_expected_from_layer(sku)
            assert result == expected_config
            
        # Verify correct file paths were used
        expected_calls = [
            f"/opt/expected_scv_resources_{sku}.json" for sku in skus
        ]
        actual_calls = [call[0][0] for call in mock_file.call_args_list]
        assert actual_calls == expected_calls

    @patch('builtins.open', new_callable=mock_open)
    def test_load_expected_from_layer_empty_file(self, mock_file):
        """Test loading expected resources from empty file"""
        # Mock empty file content
        mock_file.return_value.read.return_value = ""

        # Execute and verify exception
        with pytest.raises(json.JSONDecodeError):
            load_expected_from_layer("resell")


class TestMultiThreadedValidator:
    """Test cases for MultiThreadedValidator class"""

    def test_multithreaded_validator_init(self):
        """Test MultiThreadedValidator initialization"""
        # Mock health input
        health_input = MagicMock()
        health_input.max_threads = 5
        
        # Mock config
        config = {"LambdaFunctions": []}

        # Execute
        validator = MultiThreadedValidator(health_input, config)

        # Verify
        assert validator.health_input == health_input
        assert validator.config == config
        assert validator.errors == []

    @patch('validators.validate_lambda_permissions')
    @patch('validators.validate_event_source_mappings')
    @patch('validators.validate_triggers_by_lambda_policy')
    @patch('validators.validate_kms_aliases')
    @patch('validators.validate_kinesis')
    @patch('validators.validate_s3')
    @patch('validators.validate_alarms')
    @patch('validators.validate_policies')
    @patch('validators.validate_layers')
    @patch('validators.validate_lambdas')
    @patch('validators.validate_roles')
    def test_validate_all_resources_parallel_success(self, mock_validate_roles, mock_validate_lambdas, 
                                                   mock_validate_layers, mock_validate_policies, 
                                                   mock_validate_alarms, mock_validate_s3, 
                                                   mock_validate_kinesis, mock_validate_kms_aliases,
                                                   mock_validate_triggers, mock_validate_event_mappings,
                                                   mock_validate_lambda_permissions):
        """Test successful parallel validation of all resources"""
        # Mock health input
        health_input = MagicMock()
        health_input.max_threads = 2

        # Mock config
        config = {
            "LambdaFunctions": [{"name": "TestFunction"}],
            "IAMRoles": [{"name": "TestRole"}]
        }

        # Mock all validation results
        mock_validate_roles.return_value = {"ResourceType": "IAM Role", "DetailedHealthCheck": [{"ResourceName": "TestRole", "status": 200}]}
        mock_validate_lambdas.return_value = {"ResourceType": "Lambda Function", "DetailedHealthCheck": [{"ResourceName": "TestFunction", "status": 200}]}
        mock_validate_layers.return_value = {"ResourceType": "Lambda Layer", "DetailedHealthCheck": []}
        mock_validate_policies.return_value = {"ResourceType": "IAM Managed Policy", "DetailedHealthCheck": []}
        mock_validate_alarms.return_value = {"ResourceType": "CloudWatch Alarm", "DetailedHealthCheck": []}
        mock_validate_s3.return_value = {"ResourceType": "S3 Bucket", "DetailedHealthCheck": []}
        mock_validate_kinesis.return_value = {"ResourceType": "Kinesis Stream", "DetailedHealthCheck": []}
        mock_validate_kms_aliases.return_value = {"ResourceType": "KMS Alias", "DetailedHealthCheck": []}
        mock_validate_triggers.return_value = {"ResourceType": "EventBridge Rule", "DetailedHealthCheck": []}
        mock_validate_event_mappings.return_value = {"ResourceType": "Event Source Mapping", "DetailedHealthCheck": []}
        mock_validate_lambda_permissions.return_value = {"ResourceType": "Lambda Permission", "DetailedHealthCheck": []}

        # Execute
        validator = MultiThreadedValidator(health_input, config)
        result = validator.validate_all_resources_parallel(set())

        # Verify
        assert len(result) == 11  # All 11 validators should run
        mock_validate_lambdas.assert_called_once_with(config, health_input)
        mock_validate_roles.assert_called_once_with(config)
        # Verify specific results are in the output
        role_results = [r for r in result if r["ResourceType"] == "IAM Role"]
        lambda_results = [r for r in result if r["ResourceType"] == "Lambda Function"]
        assert len(role_results) == 1
        assert len(lambda_results) == 1

    @patch('validators.validate_lambda_permissions')
    @patch('validators.validate_event_source_mappings')
    @patch('validators.validate_triggers_by_lambda_policy')
    @patch('validators.validate_kms_aliases')
    @patch('validators.validate_kinesis')
    @patch('validators.validate_s3')
    @patch('validators.validate_alarms')
    @patch('validators.validate_policies')
    @patch('validators.validate_layers')
    @patch('validators.validate_roles')
    @patch('validators.validate_lambdas')
    def test_validate_all_resources_parallel_with_exception(self, mock_validate_lambdas, mock_validate_roles,
                                                           mock_validate_layers, mock_validate_policies,
                                                           mock_validate_alarms, mock_validate_s3,
                                                           mock_validate_kinesis, mock_validate_kms_aliases,
                                                           mock_validate_triggers, mock_validate_event_mappings,
                                                           mock_validate_lambda_permissions):
        """Test parallel validation when one validator raises exception"""
        # Mock health input
        health_input = MagicMock()
        health_input.max_threads = 2

        # Mock config
        config = {"LambdaFunctions": [{"name": "TestFunction"}]}

        # Mock validation exception for lambdas, success for others
        mock_validate_lambdas.side_effect = Exception("Validation error")
        mock_validate_roles.return_value = {"ResourceType": "IAM Role", "DetailedHealthCheck": []}
        mock_validate_layers.return_value = {"ResourceType": "Lambda Layer", "DetailedHealthCheck": []}
        mock_validate_policies.return_value = {"ResourceType": "IAM Managed Policy", "DetailedHealthCheck": []}
        mock_validate_alarms.return_value = {"ResourceType": "CloudWatch Alarm", "DetailedHealthCheck": []}
        mock_validate_s3.return_value = {"ResourceType": "S3 Bucket", "DetailedHealthCheck": []}
        mock_validate_kinesis.return_value = {"ResourceType": "Kinesis Stream", "DetailedHealthCheck": []}
        mock_validate_kms_aliases.return_value = {"ResourceType": "KMS Alias", "DetailedHealthCheck": []}
        mock_validate_triggers.return_value = {"ResourceType": "EventBridge Rule", "DetailedHealthCheck": []}
        mock_validate_event_mappings.return_value = {"ResourceType": "Event Source Mapping", "DetailedHealthCheck": []}
        mock_validate_lambda_permissions.return_value = {"ResourceType": "Lambda Permission", "DetailedHealthCheck": []}

        # Execute
        validator = MultiThreadedValidator(health_input, config)
        result = validator.validate_all_resources_parallel(set())

        # Verify - all 11 validators run, but one produces an error result
        assert len(result) == 11
        assert len(validator.errors) == 1
        assert "Failed to validate lambdas: Validation error" in validator.errors[0]

    @patch('validators.validate_lambda_permissions')
    @patch('validators.validate_event_source_mappings')
    @patch('validators.validate_triggers_by_lambda_policy')
    @patch('validators.validate_kms_aliases')
    @patch('validators.validate_kinesis')
    @patch('validators.validate_roles')
    @patch('validators.validate_layers')
    @patch('validators.validate_policies')
    @patch('validators.validate_lambdas')
    @patch('validators.validate_s3')
    @patch('validators.validate_alarms')
    def test_validate_all_resources_parallel_partial_success(self, mock_validate_alarms, mock_validate_s3,
                                                            mock_validate_lambdas, mock_validate_policies,
                                                            mock_validate_layers, mock_validate_roles,
                                                            mock_validate_kinesis, mock_validate_kms_aliases,
                                                            mock_validate_triggers, mock_validate_event_mappings,
                                                            mock_validate_lambda_permissions):
        """Test parallel validation with partial success"""
        # Mock health input
        health_input = MagicMock()
        health_input.max_threads = 2

        # Mock config
        config = {
            "S3Buckets": [{"name": "test-bucket"}],
            "CloudWatchAlarms": [{"name": "test-alarm"}]
        }

        # Mock validation results - one success, one failure
        s3_result = {
            "ResourceType": "S3 Bucket",
            "DetailedHealthCheck": [{"ResourceName": "test-bucket", "status": 200}]
        }
        mock_validate_s3.return_value = s3_result
        mock_validate_alarms.side_effect = Exception("CloudWatch error")
        
        # Mock success for other validators
        mock_validate_lambdas.return_value = {"ResourceType": "Lambda Function", "DetailedHealthCheck": []}
        mock_validate_roles.return_value = {"ResourceType": "IAM Role", "DetailedHealthCheck": []}
        mock_validate_layers.return_value = {"ResourceType": "Lambda Layer", "DetailedHealthCheck": []}
        mock_validate_policies.return_value = {"ResourceType": "IAM Managed Policy", "DetailedHealthCheck": []}
        mock_validate_kinesis.return_value = {"ResourceType": "Kinesis Stream", "DetailedHealthCheck": []}
        mock_validate_kms_aliases.return_value = {"ResourceType": "KMS Alias", "DetailedHealthCheck": []}
        mock_validate_triggers.return_value = {"ResourceType": "EventBridge Rule", "DetailedHealthCheck": []}
        mock_validate_event_mappings.return_value = {"ResourceType": "Event Source Mapping", "DetailedHealthCheck": []}
        mock_validate_lambda_permissions.return_value = {"ResourceType": "Lambda Permission", "DetailedHealthCheck": []}

        # Execute
        validator = MultiThreadedValidator(health_input, config)
        result = validator.validate_all_resources_parallel(set())

        # Verify - all 11 validators run
        assert len(result) == 11
        # Find the S3 result in the list
        s3_results = [r for r in result if r["ResourceType"] == "S3 Bucket"]
        assert len(s3_results) == 1
        assert len(validator.errors) == 1
        assert "Failed to validate alarms: CloudWatch error" in validator.errors[0]


class TestGenerateEnhancedReport:
    """Test cases for generate_enhanced_report function"""

    def test_generate_enhanced_report_all_healthy(self):
        """Test generating enhanced report with all healthy resources"""
        # Mock health input
        health_input = MagicMock()
        health_input.execution_id = "exec-123-456"
        health_input.cc_version = "19.0"
        health_input.sku = "resell"
        health_input.region = "us-west-2"

        # Mock validation results - all healthy
        validation_results = [
            {
                "ResourceType": "Lambda Function",
                "DetailedHealthCheck": [
                    {"ResourceName": "Function1", "status": 200, "message": "healthy"},
                    {"ResourceName": "Function2", "status": 200, "message": "healthy"}
                ]
            },
            {
                "ResourceType": "IAM Role",
                "DetailedHealthCheck": [
                    {"ResourceName": "Role1", "status": 200, "message": "healthy"}
                ]
            }
        ]

        execution_id = "exec-123-456"
        execution_time = 1500.0
        errors = []

        # Execute
        result = generate_enhanced_report(health_input, validation_results, execution_id, execution_time, errors)

        # Verify
        assert result["execution_metadata"]["execution_id"] == execution_id
        # execution_time_ms is only included when debug logging is enabled
        assert result["summary"]["overall_status"] == "HEALTHY"
        assert result["summary"]["total_resources"] == 3
        assert result["summary"]["healthy"] == 3
        assert result["summary"]["unhealthy"] == 0
        assert result["summary"]["error_count"] == 0
        assert result["detailed_results"] == validation_results
        assert result["errors"] == errors

    def test_generate_enhanced_report_mixed_health(self):
        """Test generating enhanced report with mixed health status"""
        # Mock health input
        health_input = MagicMock()
        health_input.execution_id = "exec-123-456"
        health_input.cc_version = "19.0"
        health_input.sku = "byoa"
        health_input.region = "eu-west-1"

        # Mock validation results - mixed health
        validation_results = [
            {
                "ResourceType": "Lambda Function",
                "DetailedHealthCheck": [
                    {"ResourceName": "Function1", "status": 200, "message": "healthy"},
                    {"ResourceName": "Function2", "status": 404, "message": "not found"}
                ]
            },
            {
                "ResourceType": "S3 Bucket",
                "DetailedHealthCheck": [
                    {"ResourceName": "Bucket1", "status": 403, "message": "access denied"}
                ]
            }
        ]

        execution_id = "exec-789-012"
        execution_time = 2500.0
        errors = ["S3 validation failed", "Lambda validation error"]

        # Execute
        result = generate_enhanced_report(health_input, validation_results, execution_id, execution_time, errors)

        # Verify
        assert result["execution_metadata"]["execution_id"] == execution_id
        # execution_time_ms is only included when debug logging is enabled
        assert result["summary"]["overall_status"] == "UNHEALTHY"
        assert result["summary"]["total_resources"] == 3
        assert result["summary"]["healthy"] == 1
        assert result["summary"]["unhealthy"] == 2
        assert result["summary"]["error_count"] == 2
        assert result["detailed_results"] == validation_results
        assert result["errors"] == errors

    def test_generate_enhanced_report_no_resources(self):
        """Test generating enhanced report with no resources"""
        # Mock health input
        health_input = MagicMock()
        health_input.execution_id = "exec-123-456"
        health_input.cc_version = "19.0"
        health_input.sku = "enterprise"
        health_input.region = "ap-southeast-1"

        # Empty validation results
        validation_results = []
        execution_id = "exec-empty-123"
        execution_time = 100.0
        errors = []

        # Execute
        result = generate_enhanced_report(health_input, validation_results, execution_id, execution_time, errors)

        # Verify
        assert result["execution_metadata"]["execution_id"] == execution_id
        # execution_time_ms is only included when debug logging is enabled
        assert result["summary"]["overall_status"] == "HEALTHY"  # No unhealthy resources
        assert result["summary"]["total_resources"] == 0
        assert result["summary"]["healthy"] == 0
        assert result["summary"]["unhealthy"] == 0
        assert result["summary"]["error_count"] == 0

    def test_generate_enhanced_report_with_warnings(self):
        """Test generating enhanced report with warning status"""
        # Mock health input
        health_input = MagicMock()
        health_input.execution_id = "exec-123-456"
        health_input.cc_version = "19.0"
        health_input.sku = "resell"
        health_input.region = "us-west-2"

        # Mock validation results with warnings (status codes like 201, 202, etc.)
        validation_results = [
            {
                "ResourceType": "Lambda Function",
                "DetailedHealthCheck": [
                    {"ResourceName": "Function1", "status": 200, "message": "healthy"},
                    {"ResourceName": "Function2", "status": 201, "message": "created but not active"}
                ]
            }
        ]

        execution_id = "exec-warn-123"
        execution_time = 800.0
        errors = []

        # Execute
        result = generate_enhanced_report(health_input, validation_results, execution_id, execution_time, errors)

        # Verify
        assert result["summary"]["total_resources"] == 2
        assert result["summary"]["healthy"] == 1  # Only 200 is considered healthy in the actual implementation
        assert result["summary"]["unhealthy"] == 0

    def test_generate_enhanced_report_metadata(self):
        """Test enhanced report metadata fields"""
        # Mock health input
        health_input = MagicMock()
        health_input.execution_id = "exec-123-456"
        health_input.cc_version = "19.0"
        health_input.sku = "resell"
        health_input.region = "us-west-2"
        health_input.cc_name = "ServiceCloudVoice"
        health_input.connect_instance_id = "12345678-1234-1234-1234-123456789012"

        validation_results = []
        execution_id = "exec-meta-123"
        execution_time = 500.0
        errors = []

        # Execute
        result = generate_enhanced_report(health_input, validation_results, execution_id, execution_time, errors)

        # Verify metadata
        metadata = result["execution_metadata"]
        input_params = result["input_parameters"]
        assert input_params["cc_version"] == "19.0"
        assert input_params["sku"] == "resell"
        assert input_params["region"] == "us-west-2"
        assert input_params["cc_name"] == "ServiceCloudVoice"
        assert input_params["connect_instance_arn"].endswith("12345678-1234-1234-1234-123456789012")
        assert "timestamp" in metadata

    def test_generate_csv_report_basic(self):
        """Test generate_csv_report with basic data."""
        from core.reporting import generate_csv_report
        
        report = {
            "detailed_results": [
                {
                    "ResourceType": "Lambda Function",
                    "DetailedHealthCheck": [
                        {
                            "ResourceName": "test-function",
                            "status": 200,
                            "message": "Function is healthy"
                        },
                        {
                            "ResourceName": "error-function", 
                            "status": 500,
                            "message": "Function has errors"
                        }
                    ]
                }
            ]
        }
        
        result = generate_csv_report(report)
        
        lines = result.split('\n')
        assert lines[0] == "ResourceName,ResourceType,Status,Message"
        assert '"test-function","Lambda Function","HEALTHY","Function is healthy"' in lines
        assert '"error-function","Lambda Function","UNHEALTHY","Function has errors"' in lines

    def test_generate_csv_report_with_quotes(self):
        """Test generate_csv_report with quotes in message."""
        from core.reporting import generate_csv_report
        
        report = {
            "detailed_results": [
                {
                    "ResourceType": "IAM Role",
                    "DetailedHealthCheck": [
                        {
                            "ResourceName": "test-role",
                            "status": 500,
                            "message": 'Error: "AccessDenied" occurred'
                        }
                    ]
                }
            ]
        }
        
        result = generate_csv_report(report)
        
        # Quotes should be escaped
        assert '""AccessDenied""' in result

    def test_generate_csv_report_empty(self):
        """Test generate_csv_report with empty data."""
        from core.reporting import generate_csv_report
        
        report = {"detailed_results": []}
        
        result = generate_csv_report(report)
        
        assert result == "ResourceName,ResourceType,Status,Message"

    def test_generate_csv_report_missing_fields(self):
        """Test generate_csv_report with missing fields."""
        from core.reporting import generate_csv_report
        
        report = {
            "detailed_results": [
                {
                    "DetailedHealthCheck": [
                        {
                            "status": 200
                            # Missing ResourceName and message
                        }
                    ]
                    # Missing ResourceType
                }
            ]
        }
        
        result = generate_csv_report(report)
        
        lines = result.split('\n')
        assert '"Unknown","Unknown","HEALTHY",""' in lines
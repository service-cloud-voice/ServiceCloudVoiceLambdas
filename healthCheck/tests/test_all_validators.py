"""
Tests for validators/all_validators.py

Specifically tests the validation logic for Lambda functions,
including the conditional alias checking (lines 241-250).
"""

import pytest
from unittest.mock import patch, MagicMock, call

# Import the module under test
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from validators.all_validators import (
    validate_lambdas, validate_roles, validate_layers, validate_policies,
    validate_alarms, validate_s3, validate_kinesis, validate_kms_aliases,
    validate_triggers_by_lambda_policy, validate_event_source_mappings,
    validate_lambda_permissions
)


class TestValidateLambdas:
    """Test cases for validate_lambdas function"""

    @patch('validators.all_validators.boto3.client')
    @patch('validators.all_validators.combine_results')
    @patch('validators.all_validators.lambda_role_correct')
    @patch('validators.all_validators.layers_attached')
    @patch('validators.all_validators.alias_exists')
    @patch('validators.all_validators.lambda_exists')
    def test_validate_lambda_with_alias_in_config(
        self, 
        mock_lambda_exists, 
        mock_alias_exists,
        mock_layers_attached, 
        mock_lambda_role_correct,
        mock_combine_results,
        mock_boto_client
    ):
        """
        Test Lambda validation when 'alias' field is present in config.
        This tests lines 241-250 where alias_exists should be called.
        """
        # Setup mock Lambda client
        mock_lmb = MagicMock()
        mock_boto_client.return_value = mock_lmb
        
        # Setup test config with alias
        config = {
            "LambdaFunctions": [
                {
                    "resource_name": "TestFunction",
                    "name": "MyOrg-TestFunction",
                    "alias": "active",
                    "layers": ["Layer1", "Layer2"],
                    "execution_role": "arn:aws:iam::123456789012:role/TestRole",
                    "triggers": [],
                    "permissions": []
                }
            ]
        }
        
        # Mock lambda_exists to return success
        mock_lambda_exists.return_value = (True, "Lambda function exists")
        
        # Mock the validation functions to return success
        mock_alias_exists.return_value = (True, "Alias 'active' exists for MyOrg-TestFunction")
        mock_layers_attached.return_value = (True, "All layers attached")
        mock_lambda_role_correct.return_value = (True, "Execution role is correct")
        
        # Mock combine_results
        mock_combine_results.return_value = {
            "ResourceName": "MyOrg-TestFunction",
            "status": 200,
            "message": "healthy"
        }
        
        # Execute
        result = validate_lambdas(config)
        
        # Verify lambda_exists was called
        mock_lambda_exists.assert_called_once_with("MyOrg-TestFunction", mock_lmb)
        
        # Verify alias_exists WAS called (because 'alias' is in config)
        mock_alias_exists.assert_called_once_with("MyOrg-TestFunction", "active", mock_lmb)
        
        # Verify layers_attached was called
        mock_layers_attached.assert_called_once_with(
            "MyOrg-TestFunction", 
            ["Layer1", "Layer2"], 
            mock_lmb
        )
        
        # Verify lambda_role_correct was called
        mock_lambda_role_correct.assert_called_once_with(
            "MyOrg-TestFunction",
            "arn:aws:iam::123456789012:role/TestRole",
            mock_lmb
        )
        
        # Verify combine_results was called with all three validation results
        mock_combine_results.assert_called_once_with(
            "MyOrg-TestFunction",
            [
                (True, "Alias 'active' exists for MyOrg-TestFunction"),
                (True, "All layers attached"),
                (True, "Execution role is correct")
            ]
        )
        
        # Verify result structure
        assert result["ResourceType"] == "Lambda Function"
        assert len(result["DetailedHealthCheck"]) == 1
        assert result["DetailedHealthCheck"][0]["ResourceName"] == "MyOrg-TestFunction"
        assert result["DetailedHealthCheck"][0]["status"] == 200

    @patch('validators.all_validators.boto3.client')
    @patch('validators.all_validators.combine_results')
    @patch('validators.all_validators.lambda_role_correct')
    @patch('validators.all_validators.layers_attached')
    @patch('validators.all_validators.alias_exists')
    @patch('validators.all_validators.lambda_exists')
    def test_validate_lambda_without_alias_in_config(
        self, 
        mock_lambda_exists, 
        mock_alias_exists,
        mock_layers_attached, 
        mock_lambda_role_correct,
        mock_combine_results,
        mock_boto_client
    ):
        """
        Test Lambda validation when 'alias' field is NOT present in config.
        This tests lines 241-250 where alias_exists should NOT be called.
        """
        # Setup mock Lambda client
        mock_lmb = MagicMock()
        mock_boto_client.return_value = mock_lmb
        
        # Setup test config WITHOUT alias
        config = {
            "LambdaFunctions": [
                {
                    "resource_name": "TestFunction",
                    "name": "MyOrg-TestFunction",
                    # No "alias" field
                    "layers": ["Layer1"],
                    "execution_role": "arn:aws:iam::123456789012:role/TestRole",
                    "triggers": [],
                    "permissions": []
                }
            ]
        }
        
        # Mock lambda_exists to return success
        mock_lambda_exists.return_value = (True, "Lambda function exists")
        
        # Mock the validation functions to return success
        mock_layers_attached.return_value = (True, "All layers attached")
        mock_lambda_role_correct.return_value = (True, "Execution role is correct")
        
        # Mock combine_results
        mock_combine_results.return_value = {
            "ResourceName": "MyOrg-TestFunction",
            "status": 200,
            "message": "healthy"
        }
        
        # Execute
        result = validate_lambdas(config)
        
        # Verify lambda_exists was called
        mock_lambda_exists.assert_called_once_with("MyOrg-TestFunction", mock_lmb)
        
        # Verify alias_exists was NOT called (because 'alias' is NOT in config)
        mock_alias_exists.assert_not_called()
        
        # Verify layers_attached was called
        mock_layers_attached.assert_called_once_with(
            "MyOrg-TestFunction", 
            ["Layer1"], 
            mock_lmb
        )
        
        # Verify lambda_role_correct was called
        mock_lambda_role_correct.assert_called_once_with(
            "MyOrg-TestFunction",
            "arn:aws:iam::123456789012:role/TestRole",
            mock_lmb
        )
        
        # Verify combine_results was called with only two validation results
        # (no alias_exists result because alias wasn't in config)
        mock_combine_results.assert_called_once_with(
            "MyOrg-TestFunction",
            [
                (True, "All layers attached"),
                (True, "Execution role is correct")
            ]
        )
        
        # Verify result structure
        assert result["ResourceType"] == "Lambda Function"
        assert len(result["DetailedHealthCheck"]) == 1

    @patch('validators.all_validators.boto3.client')
    @patch('validators.all_validators.combine_results')
    @patch('validators.all_validators.lambda_role_correct')
    @patch('validators.all_validators.layers_attached')
    @patch('validators.all_validators.alias_exists')
    @patch('validators.all_validators.lambda_exists')
    def test_validate_lambda_with_alias_empty_string(
        self, 
        mock_lambda_exists, 
        mock_alias_exists,
        mock_layers_attached, 
        mock_lambda_role_correct,
        mock_combine_results,
        mock_boto_client
    ):
        """
        Test Lambda validation when 'alias' field is present but empty string.
        This tests the edge case where alias is in config but has an empty value.
        """
        # Setup mock Lambda client
        mock_lmb = MagicMock()
        mock_boto_client.return_value = mock_lmb
        
        # Setup test config with empty alias
        config = {
            "LambdaFunctions": [
                {
                    "resource_name": "TestFunction",
                    "name": "MyOrg-TestFunction",
                    "alias": "",  # Empty alias
                    "layers": [],
                    "execution_role": "arn:aws:iam::123456789012:role/TestRole",
                    "triggers": [],
                    "permissions": []
                }
            ]
        }
        
        # Mock lambda_exists to return success
        mock_lambda_exists.return_value = (True, "Lambda function exists")
        
        # Mock the validation functions
        mock_alias_exists.return_value = (False, "Alias '' not found")
        mock_layers_attached.return_value = (True, "No layers expected.")
        mock_lambda_role_correct.return_value = (True, "Execution role is correct")
        
        # Mock combine_results
        mock_combine_results.return_value = {
            "ResourceName": "MyOrg-TestFunction",
            "status": 500,
            "message": "Alias '' not found"
        }
        
        # Execute
        result = validate_lambdas(config)
        
        # Verify alias_exists WAS called (because 'alias' key exists in config)
        mock_alias_exists.assert_called_once_with("MyOrg-TestFunction", "", mock_lmb)
        
        # Verify other validations were still called
        mock_layers_attached.assert_called_once()
        mock_lambda_role_correct.assert_called_once()

    @patch('validators.all_validators.boto3.client')
    @patch('validators.all_validators.combine_results')
    @patch('validators.all_validators.lambda_role_correct')
    @patch('validators.all_validators.layers_attached')
    @patch('validators.all_validators.alias_exists')
    @patch('validators.all_validators.lambda_exists')
    def test_validate_multiple_lambdas_mixed_alias_configs(
        self, 
        mock_lambda_exists, 
        mock_alias_exists,
        mock_layers_attached, 
        mock_lambda_role_correct,
        mock_combine_results,
        mock_boto_client
    ):
        """
        Test validating multiple Lambda functions where some have alias and some don't.
        This tests the conditional logic across multiple iterations.
        """
        # Setup mock Lambda client
        mock_lmb = MagicMock()
        mock_boto_client.return_value = mock_lmb
        
        # Setup test config with mixed alias configurations
        config = {
            "LambdaFunctions": [
                {
                    "resource_name": "Function1",
                    "name": "MyOrg-Function1",
                    "alias": "active",  # Has alias
                    "layers": [],
                    "execution_role": "arn:aws:iam::123456789012:role/Role1",
                    "triggers": [],
                    "permissions": []
                },
                {
                    "resource_name": "Function2",
                    "name": "MyOrg-Function2",
                    # No alias field
                    "layers": ["Layer1"],
                    "execution_role": "arn:aws:iam::123456789012:role/Role2",
                    "triggers": [],
                    "permissions": []
                },
                {
                    "resource_name": "Function3",
                    "name": "MyOrg-Function3",
                    "alias": "prod",  # Has alias
                    "layers": [],
                    "execution_role": "arn:aws:iam::123456789012:role/Role3",
                    "triggers": [],
                    "permissions": []
                }
            ]
        }
        
        # Mock lambda_exists to always return success
        mock_lambda_exists.return_value = (True, "Lambda function exists")
        
        # Mock the validation functions to return success
        mock_alias_exists.return_value = (True, "Alias exists")
        mock_layers_attached.return_value = (True, "Layers OK")
        mock_lambda_role_correct.return_value = (True, "Role OK")
        
        # Mock combine_results
        mock_combine_results.side_effect = [
            {"ResourceName": "MyOrg-Function1", "status": 200, "message": "healthy"},
            {"ResourceName": "MyOrg-Function2", "status": 200, "message": "healthy"},
            {"ResourceName": "MyOrg-Function3", "status": 200, "message": "healthy"}
        ]
        
        # Execute
        result = validate_lambdas(config)
        
        # Verify alias_exists was called exactly 2 times (for Function1 and Function3)
        assert mock_alias_exists.call_count == 2
        mock_alias_exists.assert_any_call("MyOrg-Function1", "active", mock_lmb)
        mock_alias_exists.assert_any_call("MyOrg-Function3", "prod", mock_lmb)
        
        # Verify layers_attached was called 3 times (for all functions)
        assert mock_layers_attached.call_count == 3
        
        # Verify lambda_role_correct was called 3 times (for all functions)
        assert mock_lambda_role_correct.call_count == 3
        
        # Verify result has all three functions
        assert result["ResourceType"] == "Lambda Function"
        assert len(result["DetailedHealthCheck"]) == 3

    @patch('validators.all_validators.boto3.client')
    @patch('validators.all_validators.combine_results')
    @patch('validators.all_validators.lambda_role_correct')
    @patch('validators.all_validators.layers_attached')
    @patch('validators.all_validators.alias_exists')
    @patch('validators.all_validators.lambda_exists')
    def test_validate_lambda_with_missing_layers_field(
        self, 
        mock_lambda_exists, 
        mock_alias_exists,
        mock_layers_attached, 
        mock_lambda_role_correct,
        mock_combine_results,
        mock_boto_client
    ):
        """
        Test Lambda validation when 'layers' field is missing (using .get default).
        This tests that layers_attached is called with empty list when field is missing.
        """
        # Setup mock Lambda client
        mock_lmb = MagicMock()
        mock_boto_client.return_value = mock_lmb
        
        # Setup test config without layers field
        config = {
            "LambdaFunctions": [
                {
                    "resource_name": "TestFunction",
                    "name": "MyOrg-TestFunction",
                    "alias": "active",
                    # No "layers" field
                    "execution_role": "arn:aws:iam::123456789012:role/TestRole",
                    "triggers": [],
                    "permissions": []
                }
            ]
        }
        
        # Mock lambda_exists to return success
        mock_lambda_exists.return_value = (True, "Lambda function exists")
        
        # Mock the validation functions
        mock_alias_exists.return_value = (True, "Alias exists")
        mock_layers_attached.return_value = (True, "No layers expected.")
        mock_lambda_role_correct.return_value = (True, "Role OK")
        
        # Mock combine_results
        mock_combine_results.return_value = {
            "ResourceName": "MyOrg-TestFunction",
            "status": 200,
            "message": "healthy"
        }
        
        # Execute
        result = validate_lambdas(config)
        
        # Verify layers_attached was called with empty list (default from .get)
        mock_layers_attached.assert_called_once_with(
            "MyOrg-TestFunction", 
            [],  # Default value from .get("layers", [])
            mock_lmb
        )

    @patch('validators.all_validators.boto3.client')
    @patch('validators.all_validators.combine_results')
    @patch('validators.all_validators.lambda_role_correct')
    @patch('validators.all_validators.layers_attached')
    @patch('validators.all_validators.alias_exists')
    @patch('validators.all_validators.lambda_exists')
    def test_validate_lambda_with_missing_execution_role_field(
        self, 
        mock_lambda_exists, 
        mock_alias_exists,
        mock_layers_attached, 
        mock_lambda_role_correct,
        mock_combine_results,
        mock_boto_client
    ):
        """
        Test Lambda validation when 'execution_role' field is missing (using .get default).
        This tests that lambda_role_correct is called with None when field is missing.
        """
        # Setup mock Lambda client
        mock_lmb = MagicMock()
        mock_boto_client.return_value = mock_lmb
        
        # Setup test config without execution_role field
        config = {
            "LambdaFunctions": [
                {
                    "resource_name": "TestFunction",
                    "name": "MyOrg-TestFunction",
                    "alias": "active",
                    "layers": [],
                    # No "execution_role" field
                    "triggers": [],
                    "permissions": []
                }
            ]
        }
        
        # Mock lambda_exists to return success
        mock_lambda_exists.return_value = (True, "Lambda function exists")
        
        # Mock the validation functions
        mock_alias_exists.return_value = (True, "Alias exists")
        mock_layers_attached.return_value = (True, "Layers OK")
        mock_lambda_role_correct.return_value = (True, "No execution role expected.")
        
        # Mock combine_results
        mock_combine_results.return_value = {
            "ResourceName": "MyOrg-TestFunction",
            "status": 200,
            "message": "healthy"
        }
        
        # Execute
        result = validate_lambdas(config)
        
        # Verify lambda_role_correct was called with None (default from .get)
        mock_lambda_role_correct.assert_called_once_with(
            "MyOrg-TestFunction",
            None,  # Default value from .get("execution_role")
            mock_lmb
        )

    @patch('validators.all_validators.boto3.client')
    @patch('validators.all_validators.lambda_exists')
    def test_validate_lambda_when_lambda_not_exists(
        self, 
        mock_lambda_exists,
        mock_boto_client
    ):
        """
        Test that validation functions are NOT called when lambda_exists returns False.
        This tests the early return when function doesn't exist (before lines 241-250).
        """
        # Setup mock Lambda client
        mock_lmb = MagicMock()
        mock_boto_client.return_value = mock_lmb
        
        # Setup test config
        config = {
            "LambdaFunctions": [
                {
                    "resource_name": "TestFunction",
                    "name": "MyOrg-TestFunction",
                    "alias": "active",
                    "layers": ["Layer1"],
                    "execution_role": "arn:aws:iam::123456789012:role/TestRole",
                    "triggers": [],
                    "permissions": []
                }
            ]
        }
        
        # Mock lambda_exists to return failure
        mock_lambda_exists.return_value = (False, "ERROR: Lambda function MyOrg-TestFunction not found")
        
        # Execute
        with patch('validators.all_validators.alias_exists') as mock_alias_exists, \
             patch('validators.all_validators.layers_attached') as mock_layers_attached, \
             patch('validators.all_validators.lambda_role_correct') as mock_lambda_role_correct:
            
            result = validate_lambdas(config)
            
            # Verify that when lambda doesn't exist, the validation functions are NOT called
            mock_alias_exists.assert_not_called()
            mock_layers_attached.assert_not_called()
            mock_lambda_role_correct.assert_not_called()
            
            # Verify error is in result
            assert result["ResourceType"] == "Lambda Function"
            assert len(result["DetailedHealthCheck"]) == 1
            assert result["DetailedHealthCheck"][0]["status"] == 500
            assert "not found" in result["DetailedHealthCheck"][0]["message"]

    def test_verify_lambda_function_exists_success(self):
        """Test _verify_lambda_function_exists when function exists."""
        from validators.all_validators import _verify_lambda_function_exists
        
        mock_lambda_client = MagicMock()
        mock_lambda_client.get_function.return_value = {"Configuration": {"FunctionName": "test-function"}}
        
        health_checks = []
        result = _verify_lambda_function_exists("test-function", mock_lambda_client, health_checks)
        
        assert result == "test-function"
        assert len(health_checks) == 0
        mock_lambda_client.get_function.assert_called_once_with(FunctionName="test-function")

    def test_verify_lambda_function_not_found(self):
        """Test _verify_lambda_function_exists when function doesn't exist."""
        from validators.all_validators import _verify_lambda_function_exists
        from botocore.exceptions import ClientError
        
        mock_lambda_client = MagicMock()
        mock_lambda_client.get_function.side_effect = ClientError(
            {'Error': {'Code': 'ResourceNotFoundException'}}, 'GetFunction'
        )
        
        health_checks = []
        result = _verify_lambda_function_exists("missing-function", mock_lambda_client, health_checks)
        
        assert result is None
        assert len(health_checks) == 1
        assert health_checks[0]["ResourceName"] == "ProviderCreator"
        assert health_checks[0]["status"] == 500
        assert "not found" in health_checks[0]["message"]

    def test_verify_lambda_function_access_denied(self):
        """Test _verify_lambda_function_exists with access denied error."""
        from validators.all_validators import _verify_lambda_function_exists
        from botocore.exceptions import ClientError
        
        mock_lambda_client = MagicMock()
        mock_lambda_client.get_function.side_effect = ClientError(
            {'Error': {'Code': 'AccessDeniedException'}}, 'GetFunction'
        )
        
        health_checks = []
        result = _verify_lambda_function_exists("error-function", mock_lambda_client, health_checks)
        
        assert result is None
        assert len(health_checks) == 1
        assert health_checks[0]["ResourceName"] == "ProviderCreator"
        assert health_checks[0]["status"] == 500
        assert "Cannot verify" in health_checks[0]["message"]


class TestValidateRoles:
    """Test validate_roles function."""

    @patch('validators.all_validators.boto3.client')
    def test_validate_roles_success(self, mock_boto3_client):
        """Test successful role validation."""
        mock_sts = MagicMock()
        mock_sts.get_caller_identity.return_value = {"Account": "123456789012"}
        mock_iam = MagicMock()
        
        mock_boto3_client.side_effect = lambda service: mock_sts if service == "sts" else mock_iam
        
        with patch('validators.all_validators.iam_role_exists') as mock_role_exists:
            mock_role_exists.return_value = (True, "Role exists")
            
            cfg = {
                "IAMRoles": [
                    {"name": "test-role", "simulate_actions": []}
                ]
            }
            
            result = validate_roles(cfg)
            
            assert result["ResourceType"] == "IAM Role"
            assert isinstance(result["DetailedHealthCheck"], list)

    @patch('validators.all_validators.boto3.client')
    def test_validate_roles_missing_role(self, mock_boto3_client):
        """Test validation with missing role."""
        mock_sts = MagicMock()
        mock_sts.get_caller_identity.return_value = {"Account": "123456789012"}
        mock_iam = MagicMock()
        
        mock_boto3_client.side_effect = lambda service: mock_sts if service == "sts" else mock_iam
        
        with patch('validators.all_validators.iam_role_exists') as mock_role_exists:
            mock_role_exists.return_value = (False, "Role not found")
            
            cfg = {
                "IAMRoles": [
                    {"name": "missing-role"}
                ]
            }
            
            result = validate_roles(cfg)
            
            assert len(result["DetailedHealthCheck"]) == 1
            assert result["DetailedHealthCheck"][0]["status"] == 500

    @patch('validators.all_validators.boto3.client')
    def test_validate_roles_sts_error(self, mock_boto3_client):
        """Test validation when STS fails."""
        mock_sts = MagicMock()
        mock_sts.get_caller_identity.side_effect = Exception("STS Error")
        mock_iam = MagicMock()
        
        mock_boto3_client.side_effect = lambda service: mock_sts if service == "sts" else mock_iam
        
        with patch('validators.all_validators.iam_role_exists') as mock_role_exists:
            mock_role_exists.return_value = (True, "Role exists")
            
            cfg = {
                "IAMRoles": [
                    {"name": "test-role", "simulate_actions": ["s3:GetObject"]}
                ]
            }
            
            result = validate_roles(cfg)
            
            assert result["ResourceType"] == "IAM Role"

    @patch('validators.all_validators.boto3.client')
    def test_validate_roles_with_simulation(self, mock_boto3_client):
        """Test role validation with action simulation."""
        mock_sts = MagicMock()
        mock_sts.get_caller_identity.return_value = {"Account": "123456789012"}
        mock_iam = MagicMock()
        
        mock_boto3_client.side_effect = lambda service: mock_sts if service == "sts" else mock_iam
        
        with patch('validators.all_validators.iam_role_exists') as mock_role_exists, \
             patch('validators.all_validators.simulate_actions') as mock_simulate:
            
            mock_role_exists.return_value = (True, "Role exists")
            mock_simulate.return_value = [(True, "Action allowed")]
            
            cfg = {
                "IAMRoles": [
                    {"name": "test-role", "simulate_actions": ["s3:GetObject"]}
                ]
            }
            
            result = validate_roles(cfg)
            
            assert result["ResourceType"] == "IAM Role"
            mock_simulate.assert_called_once()


class TestValidateLayers:
    """Test validate_layers function."""

    @patch('validators.all_validators.boto3.client')
    def test_validate_layers_success(self, mock_boto3_client):
        """Test successful layer validation."""
        mock_lambda = MagicMock()
        mock_boto3_client.return_value = mock_lambda
        
        with patch('validators.all_validators.lambda_layer_exists') as mock_layer_exists, \
             patch('validators.all_validators.combine_results') as mock_combine:
            
            mock_layer_exists.return_value = (True, "Layer exists")
            mock_combine.return_value = {"ResourceName": "test-layer", "status": 200}
            
            cfg = {
                "LambdaLayers": [
                    {"name": "test-layer", "version": 1}
                ]
            }
            
            result = validate_layers(cfg)
            
            assert result["ResourceType"] == "Lambda Layer"
            assert len(result["DetailedHealthCheck"]) == 1

    @patch('validators.all_validators.boto3.client')
    def test_validate_layers_empty_config(self, mock_boto3_client):
        """Test layer validation with empty config."""
        mock_lambda = MagicMock()
        mock_boto3_client.return_value = mock_lambda
        
        cfg = {"LambdaLayers": []}
        
        result = validate_layers(cfg)
        
        assert result["ResourceType"] == "Lambda Layer"
        assert len(result["DetailedHealthCheck"]) == 0


class TestValidatePolicies:
    """Test validate_policies function."""

    @patch('validators.all_validators.boto3.client')
    def test_validate_policies_success(self, mock_boto3_client):
        """Test successful policy validation."""
        mock_iam = MagicMock()
        mock_boto3_client.return_value = mock_iam
        
        with patch('validators.all_validators.managed_policy_valid') as mock_policy_valid, \
             patch('validators.all_validators.combine_results') as mock_combine:
            
            mock_policy_valid.return_value = (True, "Policy valid")
            mock_combine.return_value = {"ResourceName": "test-policy", "status": 200}
            
            cfg = {
                "ManagedPolicies": [
                    {"name": "test-policy"}
                ]
            }
            
            result = validate_policies(cfg)
            
            assert result["ResourceType"] == "IAM Managed Policy"
            assert len(result["DetailedHealthCheck"]) == 1


class TestValidateAlarms:
    """Test validate_alarms function."""

    @patch('validators.all_validators.boto3.client')
    def test_validate_alarms_success(self, mock_boto3_client):
        """Test successful alarm validation."""
        mock_cloudwatch = MagicMock()
        mock_boto3_client.return_value = mock_cloudwatch
        
        with patch('validators.all_validators.alarm_exists') as mock_alarm_exists, \
             patch('validators.all_validators.combine_results') as mock_combine:
            
            mock_alarm_exists.return_value = ({"StateValue": "OK"}, "Alarm exists")
            mock_combine.return_value = {"ResourceName": "test-alarm", "status": 200}
            
            cfg = {
                "CloudWatchAlarms": [
                    {"name": "test-alarm"}
                ]
            }
            
            result = validate_alarms(cfg)
            
            assert result["ResourceType"] == "CloudWatch Alarm"
            assert len(result["DetailedHealthCheck"]) == 1


class TestValidateS3:
    """Test validate_s3 function."""

    @patch('validators.all_validators.boto3.client')
    def test_validate_s3_success(self, mock_boto3_client):
        """Test successful S3 validation."""
        mock_s3 = MagicMock()
        mock_boto3_client.return_value = mock_s3
        
        with patch('validators.all_validators.s3_bucket_exists') as mock_bucket_exists, \
             patch('validators.all_validators.combine_results') as mock_combine:
            
            mock_bucket_exists.return_value = (True, "Bucket exists")
            mock_combine.return_value = {"ResourceName": "test-bucket", "status": 200}
            
            cfg = {
                "S3Buckets": [
                    {"name": "test-bucket"}
                ]
            }
            
            result = validate_s3(cfg)
            
            assert result["ResourceType"] == "S3 Bucket"
            assert len(result["DetailedHealthCheck"]) == 1


class TestValidateKinesis:
    """Test validate_kinesis function."""

    @patch('validators.all_validators.boto3.client')
    def test_validate_kinesis_success(self, mock_boto3_client):
        """Test successful Kinesis validation."""
        mock_kinesis = MagicMock()
        mock_boto3_client.return_value = mock_kinesis
        
        with patch('validators.all_validators.kinesis_stream_exists') as mock_stream_exists, \
             patch('validators.all_validators.combine_results') as mock_combine:
            
            mock_stream_exists.return_value = (True, "Stream exists")
            mock_combine.return_value = {"ResourceName": "test-stream", "status": 200}
            
            cfg = {
                "KinesisStreams": [
                    {"name": "test-stream"}
                ]
            }
            
            result = validate_kinesis(cfg)
            
            assert result["ResourceType"] == "Kinesis Stream"
            assert len(result["DetailedHealthCheck"]) == 1


class TestValidateKmsAliases:
    """Test validate_kms_aliases function."""

    @patch('validators.all_validators.boto3.client')
    def test_validate_kms_aliases_success(self, mock_boto3_client):
        """Test successful KMS alias validation."""
        mock_kms = MagicMock()
        mock_boto3_client.return_value = mock_kms
        
        with patch('validators.all_validators.key_is_enabled') as mock_key_enabled, \
             patch('validators.all_validators.combine_results') as mock_combine:
            
            mock_key_enabled.return_value = (True, "Key enabled")
            mock_combine.return_value = {"ResourceName": "test-alias", "status": 200}
            
            cfg = {
                "KMSAliases": [
                    {"name": "test-alias"}
                ]
            }
            
            result = validate_kms_aliases(cfg)
            
            assert result["ResourceType"] == "KMS Alias"
            assert len(result["DetailedHealthCheck"]) == 1


class TestValidateTriggersAndPermissions:
    """Test trigger and permission validation functions."""

    @patch('validators.all_validators.boto3.client')
    def test_validate_triggers_by_lambda_policy_empty_config(self, mock_boto3_client):
        """Test trigger validation with empty config."""
        mock_events = MagicMock()
        mock_boto3_client.return_value = mock_events
        
        cfg = {"EventBridgeRules": []}
        all_lambda_names = set()
        
        result = validate_triggers_by_lambda_policy(cfg, all_lambda_names)
        
        assert result["ResourceType"] == "EventBridge Rule"
        assert len(result["DetailedHealthCheck"]) == 0

    @patch('validators.all_validators.boto3.client')
    def test_validate_event_source_mappings_empty_config(self, mock_boto3_client):
        """Test event source mapping validation with empty config."""
        mock_lambda = MagicMock()
        mock_boto3_client.return_value = mock_lambda
        
        cfg = {"EventSourceMappings": []}
        all_lambda_names = set()
        
        result = validate_event_source_mappings(cfg, all_lambda_names)
        
        assert result["ResourceType"] == "Event Source Mapping"
        assert len(result["DetailedHealthCheck"]) == 0

    @patch('validators.all_validators.boto3.client')
    def test_validate_lambda_permissions_empty_config(self, mock_boto3_client):
        """Test lambda permission validation with empty config."""
        mock_lambda = MagicMock()
        mock_boto3_client.return_value = mock_lambda
        
        cfg = {"LambdaPermissions": []}
        all_lambda_names = set()
        
        result = validate_lambda_permissions(cfg, all_lambda_names)
        
        assert result["ResourceType"] == "Lambda Permission"
        assert len(result["DetailedHealthCheck"]) == 0

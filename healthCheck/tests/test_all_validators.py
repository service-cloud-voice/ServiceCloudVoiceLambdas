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

from validators.all_validators import (
    validate_lambdas, validate_roles, validate_layers, validate_policies,
    validate_alarms, validate_s3, validate_kinesis, validate_kms_aliases,
    validate_triggers_by_lambda_policy, validate_event_source_mappings,
    validate_lambda_permissions, _get_connect_resource_for_role,
    _verify_role_has_connect_bucket_in_policy, _verify_s3_bucket_matches_connect
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
        
        # Verify lambda_role_correct was called with additional params for triggers
        mock_lambda_role_correct.assert_called_once_with(
            "MyOrg-TestFunction",
            "arn:aws:iam::123456789012:role/TestRole",
            mock_lmb,
            [],  # triggers
            config,  # cfg
            None  # health_input
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
        
        # Verify lambda_role_correct was called with additional params
        mock_lambda_role_correct.assert_called_once_with(
            "MyOrg-TestFunction",
            "arn:aws:iam::123456789012:role/TestRole",
            mock_lmb,
            [],  # triggers
            config,  # cfg
            None  # health_input
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
            mock_lmb,
            [],  # triggers
            config,  # cfg
            None  # health_input
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

    @patch('validators.all_validators.boto3.client')
    def test_validate_s3_byoac_customer_configured(self, mock_boto3_client):
        """Test BYOAC S3 validation with customer-configured bucket."""
        mock_s3 = MagicMock()
        mock_boto3_client.return_value = mock_s3
        
        with patch('validators.all_validators.s3_bucket_exists') as mock_bucket_exists, \
             patch('validators.all_validators.combine_results') as mock_combine, \
             patch.dict('os.environ', {
                 'CUSTOMER_CONFIGURED_S3_BUCKET_NAME': 'customer-reports-bucket',
                 'S3_BUCKET_FOR_TENANT_RESOURCES': 'scv-tenant-bucket',
                 'AWS_ACCOUNT_ID': '123456789012',
                 'CALL_CENTER_API_NAME': 'test-api'
             }):
            
            mock_bucket_exists.return_value = (True, "Customer bucket exists")
            mock_combine.return_value = {"ResourceName": "customer-reports-bucket", "status": 200}
            
            # Mock health_input for BYOAC with different buckets
            health_input = MagicMock()
            health_input.sku = 'byoac'
            health_input.s3_bucket_for_tenant_resources = 'scv-tenant-bucket'
            health_input.s3_bucket_for_reports = 'customer-reports-bucket'
            health_input.connect_instance_id = None  # No Connect verification for this test
            
            cfg = {
                "S3Buckets": [
                    {
                        "resource_name": "S3Bucket",
                        "name": "customer-reports-bucket"
                    }
                ]
            }
            
            result = validate_s3(cfg, health_input)
            
            # Should validate the bucket
            mock_bucket_exists.assert_called_once_with('customer-reports-bucket', mock_s3)
            assert result["ResourceType"] == "S3 Bucket"
            assert len(result["DetailedHealthCheck"]) == 1

    @patch('validators.all_validators.boto3.client')
    def test_validate_s3_byoac_scv_managed(self, mock_boto3_client):
        """Test BYOAC S3 validation with SCV-managed bucket."""
        mock_s3 = MagicMock()
        mock_boto3_client.return_value = mock_s3
        
        with patch('validators.all_validators.s3_bucket_exists') as mock_bucket_exists, \
             patch('validators.all_validators.combine_results') as mock_combine, \
             patch.dict('os.environ', {
                 'CUSTOMER_CONFIGURED_S3_BUCKET_NAME': '',  # Empty - use SCV managed
                 'S3_BUCKET_FOR_TENANT_RESOURCES': 'scv-tenant-bucket',
                 'AWS_ACCOUNT_ID': '123456789012',
                 'CALL_CENTER_API_NAME': 'test-api'
             }):
            
            mock_bucket_exists.return_value = (True, "SCV bucket exists")
            mock_combine.return_value = {"ResourceName": "scv-bucket", "status": 200}
            
            # Mock health_input for BYOAC with same buckets (SCV managed)
            health_input = MagicMock()
            health_input.sku = 'byoac'
            health_input.s3_bucket_for_tenant_resources = 'scv-tenant-bucket'
            health_input.s3_bucket_for_reports = 'scv-tenant-bucket'
            health_input.connect_instance_id = None  # No Connect verification for this test
            
            cfg = {
                "S3Buckets": [
                    {
                        "resource_name": "S3Bucket",
                        "name": "scv-tenant-bucket"
                    }
                ]
            }
            
            result = validate_s3(cfg, health_input)
            
            # Should use SCV managed bucket
            mock_bucket_exists.assert_called_once_with('scv-tenant-bucket', mock_s3)
            assert result["ResourceType"] == "S3 Bucket"
            assert len(result["DetailedHealthCheck"]) == 1

    @patch('validators.all_validators.boto3.client')
    def test_validate_s3_non_byoac_fallback(self, mock_boto3_client):
        """Test non-BYOAC S3 validation falls back to first option."""
        mock_s3 = MagicMock()
        mock_boto3_client.return_value = mock_s3
        
        with patch('validators.all_validators.s3_bucket_exists') as mock_bucket_exists, \
             patch('validators.all_validators.combine_results') as mock_combine:
            
            mock_bucket_exists.return_value = (True, "Fallback bucket exists")
            mock_combine.return_value = {"ResourceName": "fallback-bucket", "status": 200}
            
            # Mock health_input for non-BYOAC SKU
            health_input = MagicMock()
            health_input.sku = 'resell'
            health_input.connect_instance_id = None  # No Connect verification
            
            cfg = {
                "S3Buckets": [
                    {
                        "resource_name": "S3Bucket",
                        "name": "fallback-bucket"
                    }
                ]
            }
            
            result = validate_s3(cfg, health_input)
            
            # Should use first option as fallback
            mock_bucket_exists.assert_called_once_with('fallback-bucket', mock_s3)
            assert result["ResourceType"] == "S3 Bucket"
            assert len(result["DetailedHealthCheck"]) == 1

    @patch('validators.all_validators.boto3.client')
    def test_validate_s3_connect_verification_customer_configured(self, mock_boto3_client):
        """Test S3 validation with Connect verification for customer-configured bucket."""
        mock_s3 = MagicMock()
        mock_boto3_client.return_value = mock_s3
        
        with patch('validators.all_validators.s3_bucket_exists') as mock_bucket_exists, \
             patch('validators.all_validators.combine_results') as mock_combine, \
             patch('utils.stream_discovery.discover_connect_s3_storage') as mock_discover_storage, \
             patch.dict('os.environ', {
                 'CUSTOMER_CONFIGURED_S3_BUCKET_NAME': 'customer-bucket',
                 'AWS_ACCOUNT_ID': '123456789012'
             }):
            
            mock_bucket_exists.return_value = (True, "Bucket exists")
            mock_combine.return_value = {"ResourceName": "customer-bucket", "status": 200}
            
            # Mock Connect storage discovery - bucket matches
            mock_discover_storage.return_value = {
                'call_recordings_s3_bucket': 'customer-bucket',
                'chat_transcripts_s3_bucket': 'customer-bucket'
            }
            
            # Mock health_input with Connect instance ID (non-importxml SKU)
            health_input = MagicMock()
            health_input.connect_instance_id = 'test-instance-id'
            health_input.sku = 'byoa'  # Not importxml/multiorg
            
            cfg = {
                "S3Buckets": [
                    {
                        "resource_name": "S3Bucket",
                        "name": "customer-bucket"
                    }
                ]
            }
            
            result = validate_s3(cfg, health_input)
            
            # Should validate customer bucket
            mock_bucket_exists.assert_called_once_with('customer-bucket', mock_s3)
            mock_discover_storage.assert_called_once_with('test-instance-id')
            assert result["ResourceType"] == "S3 Bucket"
            assert len(result["DetailedHealthCheck"]) == 1

    @patch('validators.all_validators.boto3.client')
    def test_validate_s3_with_connect_verification_scv_managed(self, mock_boto3_client):
        """Test S3 validation with Connect verification for SCV-managed bucket."""
        mock_s3 = MagicMock()
        mock_boto3_client.return_value = mock_s3
        
        with patch('validators.all_validators.s3_bucket_exists') as mock_bucket_exists, \
             patch('validators.all_validators.combine_results') as mock_combine, \
             patch('utils.stream_discovery.discover_connect_s3_storage') as mock_discover_storage, \
             patch.dict('os.environ', {
                 'CUSTOMER_CONFIGURED_S3_BUCKET_NAME': '',  # Empty - SCV managed
                 'AWS_ACCOUNT_ID': '123456789012'
             }):
            
            mock_bucket_exists.return_value = (True, "Bucket exists")
            mock_combine.return_value = {"ResourceName": "scv-managed-bucket", "status": 200}
            
            # Mock Connect storage discovery - bucket matches what health check expects
            mock_discover_storage.return_value = {
                'call_recordings_s3_bucket': 'scv-managed-bucket',
                'chat_transcripts_s3_bucket': 'scv-managed-bucket'
            }
            
            # Mock health_input with Connect instance ID
            health_input = MagicMock()
            health_input.connect_instance_id = 'test-instance-id'
            
            cfg = {
                "S3Buckets": [
                    {
                        "resource_name": "S3Bucket",
                        "name": "scv-managed-bucket"
                    }
                ]
            }
            
            result = validate_s3(cfg, health_input)
            
            # Should validate SCV bucket and verify it matches Connect configuration
            mock_bucket_exists.assert_called_once_with('scv-managed-bucket', mock_s3)
            mock_discover_storage.assert_called_once_with('test-instance-id')
            assert result["ResourceType"] == "S3 Bucket"
            assert len(result["DetailedHealthCheck"]) == 1

    @patch('validators.all_validators.boto3.client')
    def test_validate_s3_with_connect_verification_mismatch(self, mock_boto3_client):
        """Test S3 validation with Connect verification when buckets don't match (non-importxml)."""
        mock_s3 = MagicMock()
        mock_boto3_client.return_value = mock_s3
        
        with patch('validators.all_validators.s3_bucket_exists') as mock_bucket_exists, \
             patch('utils.stream_discovery.discover_connect_s3_storage') as mock_discover_storage, \
             patch.dict('os.environ', {
                 'CUSTOMER_CONFIGURED_S3_BUCKET_NAME': '',  # Empty - SCV managed
                 'AWS_ACCOUNT_ID': '123456789012'
             }):
            
            mock_bucket_exists.return_value = (True, "Bucket exists")
            
            # Mock Connect storage discovery - bucket DOESN'T match what health check expects
            mock_discover_storage.return_value = {
                'call_recordings_s3_bucket': 'different-bucket',
                'chat_transcripts_s3_bucket': 'different-bucket'
            }
            
            # Mock health_input with Connect instance ID (non-importxml SKU - mismatch should error)
            health_input = MagicMock()
            health_input.connect_instance_id = 'test-instance-id'
            health_input.sku = 'byoa'  # Not importxml/multiorg - mismatch is an error
            
            cfg = {
                "S3Buckets": [
                    {
                        "resource_name": "S3Bucket",
                        "name": "expected-bucket"
                    }
                ]
            }
            
            result = validate_s3(cfg, health_input)
            
            # For non-importxml, when Connect verification fails with mismatch,
            # the function returns error directly without calling s3_bucket_exists
            mock_discover_storage.assert_called_once_with('test-instance-id')
            assert result["ResourceType"] == "S3 Bucket"
            assert len(result["DetailedHealthCheck"]) == 1
            assert result["DetailedHealthCheck"][0]["status"] == 500
            assert "mismatch" in result["DetailedHealthCheck"][0]["message"]

    @patch('validators.all_validators.boto3.client')
    def test_validate_s3_with_connect_verification_multiple_buckets(self, mock_boto3_client):
        """Test S3 validation with multiple buckets - only S3Bucket resource gets Connect verification."""
        mock_s3 = MagicMock()
        mock_boto3_client.return_value = mock_s3
        
        with patch('validators.all_validators.s3_bucket_exists') as mock_bucket_exists, \
             patch('validators.all_validators.combine_results') as mock_combine, \
             patch('utils.stream_discovery.discover_connect_s3_storage') as mock_discover_storage, \
             patch.dict('os.environ', {
                 'CUSTOMER_CONFIGURED_S3_BUCKET_NAME': '',  # Empty - SCV managed
                 'AWS_ACCOUNT_ID': '123456789012'
             }):
            
            mock_bucket_exists.return_value = (True, "Bucket exists")
            mock_combine.return_value = {"ResourceName": "test-bucket", "status": 200}
            
            # Mock Connect storage discovery
            mock_discover_storage.return_value = {
                'call_recordings_s3_bucket': 'main-bucket',
                'chat_transcripts_s3_bucket': 'main-bucket'
            }
            
            # Mock health_input with Connect instance ID
            health_input = MagicMock()
            health_input.connect_instance_id = 'test-instance-id'
            
            cfg = {
                "S3Buckets": [
                    {
                        "resource_name": "S3Bucket",  # This should get Connect verification
                        "name": "main-bucket"
                    },
                    {
                        "resource_name": "CloudTrailS3Bucket",  # This should NOT get Connect verification
                        "name": "cloudtrail-bucket"
                    },
                    {
                        "resource_name": "AnotherBucket",  # This should NOT get Connect verification
                        "name": "another-bucket"
                    }
                ]
            }
            
            result = validate_s3(cfg, health_input)
            
            # Should validate all buckets but only apply Connect verification to S3Bucket
            assert mock_bucket_exists.call_count == 3
            mock_discover_storage.assert_called_once_with('test-instance-id')  # Only called once
            assert result["ResourceType"] == "S3 Bucket"
            assert len(result["DetailedHealthCheck"]) == 3

    @patch('validators.all_validators.boto3.client')
    def test_validate_s3_with_connect_verification_no_s3bucket_resource(self, mock_boto3_client):
        """Test S3 validation with no S3Bucket resource - no Connect discovery should happen."""
        mock_s3 = MagicMock()
        mock_boto3_client.return_value = mock_s3
        
        with patch('validators.all_validators.s3_bucket_exists') as mock_bucket_exists, \
             patch('validators.all_validators.combine_results') as mock_combine, \
             patch('utils.stream_discovery.discover_connect_storage') as mock_discover_storage:
            
            mock_bucket_exists.return_value = (True, "Bucket exists")
            mock_combine.return_value = {"ResourceName": "test-bucket", "status": 200}
            
            # Mock health_input with Connect instance ID
            health_input = MagicMock()
            health_input.connect_instance_id = 'test-instance-id'
            
            cfg = {
                "S3Buckets": [
                    {
                        "resource_name": "CloudTrailS3Bucket",  # Not S3Bucket
                        "name": "cloudtrail-bucket"
                    },
                    {
                        "resource_name": "AnotherBucket",  # Not S3Bucket
                        "name": "another-bucket"
                    }
                ]
            }
            
            result = validate_s3(cfg, health_input)
            
            # Should validate buckets but NOT call Connect discovery
            assert mock_bucket_exists.call_count == 2
            mock_discover_storage.assert_not_called()  # Should not be called
            assert result["ResourceType"] == "S3 Bucket"
            assert len(result["DetailedHealthCheck"]) == 2


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


class TestValidateTriggersComprehensive:
    """Comprehensive tests for validate_triggers_by_lambda_policy function"""

    @patch('validators.all_validators.boto3.client')
    @patch('validators.all_validators.get_lambda_policy')
    @patch('validators.all_validators.combine_results')
    def test_validate_triggers_with_valid_rule(self, mock_combine_results, mock_get_lambda_policy, mock_boto3_client):
        """Test EventBridge rule validation with valid configuration"""
        # Setup mocks
        mock_events = MagicMock()
        mock_lambda = MagicMock()
        mock_boto3_client.side_effect = [mock_events, mock_lambda]
        
        # Mock policy with EventBridge trigger
        mock_policy = {
            "Statement": [{
                "Principal": {"Service": "events.amazonaws.com"},
                "Condition": {
                    "ArnLike": {
                        "AWS:SourceArn": "arn:aws:events:us-east-1:123456789012:rule/test-rule"
                    }
                }
            }]
        }
        mock_get_lambda_policy.return_value = mock_policy
        mock_combine_results.return_value = {"ResourceName": "test-rule", "status": 200}
        
        cfg = {
            "EventBridgeRules": [{
                "name": "test-rule",
                "targets": ["test-lambda"]
            }]
        }
        all_lambda_names = {"test-lambda"}
        
        result = validate_triggers_by_lambda_policy(cfg, all_lambda_names)
        
        assert result["ResourceType"] == "EventBridge Rule"
        mock_get_lambda_policy.assert_called_once_with("test-lambda", mock_lambda)

    @patch('validators.all_validators.boto3.client')
    @patch('validators.all_validators.combine_results')
    def test_validate_triggers_no_targets(self, mock_combine_results, mock_boto3_client):
        """Test EventBridge rule validation with no targets"""
        mock_events = MagicMock()
        mock_lambda = MagicMock()
        mock_boto3_client.side_effect = [mock_events, mock_lambda]
        mock_combine_results.return_value = {"ResourceName": "test-rule", "status": 500}
        
        cfg = {
            "EventBridgeRules": [{
                "name": "test-rule"
                # No targets field
            }]
        }
        all_lambda_names = set()
        
        result = validate_triggers_by_lambda_policy(cfg, all_lambda_names)
        
        assert result["ResourceType"] == "EventBridge Rule"
        mock_combine_results.assert_called_once_with("test-rule", [(False, "Rule has no targets defined in expected config.")])

    @patch('validators.all_validators.boto3.client')
    @patch('validators.all_validators.get_lambda_policy')
    @patch('validators.all_validators.combine_results')
    def test_validate_triggers_no_policy(self, mock_combine_results, mock_get_lambda_policy, mock_boto3_client):
        """Test EventBridge rule validation when Lambda has no policy"""
        mock_events = MagicMock()
        mock_lambda = MagicMock()
        mock_boto3_client.side_effect = [mock_events, mock_lambda]
        mock_get_lambda_policy.return_value = None
        mock_combine_results.return_value = {"ResourceName": "test-rule", "status": 500}
        
        cfg = {
            "EventBridgeRules": [{
                "name": "test-rule",
                "targets": ["test-lambda"]
            }]
        }
        all_lambda_names = {"test-lambda"}
        
        result = validate_triggers_by_lambda_policy(cfg, all_lambda_names)
        
        assert result["ResourceType"] == "EventBridge Rule"
        mock_combine_results.assert_called_once_with("test-rule", [(False, "No resource policy found for target Lambda 'test-lambda'")])


class TestValidateEventSourceMappingsComprehensive:
    """Comprehensive tests for validate_event_source_mappings function"""

    @patch('validators.all_validators.boto3.client')
    @patch('validators.all_validators._resolve_event_source')
    @patch('validators.all_validators.combine_results')
    def test_validate_event_source_mappings_success(self, mock_combine_results, mock_resolve_event_source, mock_boto3_client):
        """Test successful event source mapping validation"""
        mock_lambda = MagicMock()
        mock_boto3_client.return_value = mock_lambda
        
        # Mock successful mapping
        mock_mapping = {
            'UUID': 'test-uuid',
            'EventSourceArn': 'arn:aws:kinesis:us-east-1:123456789012:stream/test-stream',
            'FunctionName': 'test-function',
            'State': 'Enabled'
        }
        mock_lambda.list_event_source_mappings.return_value = {'EventSourceMappings': [mock_mapping]}
        
        mock_resolve_event_source.return_value = "arn:aws:kinesis:us-east-1:123456789012:stream/test-stream"
        mock_combine_results.return_value = {"ResourceName": "TestMapping", "status": 200}
        
        cfg = {
            "EventSourceMappings": [{
                "name": "TestMapping",
                "function": "test-function",
                "event_source": "arn:aws:kinesis:us-east-1:123456789012:stream/test-stream"
            }]
        }
        all_lambda_names = {"test-function"}
        
        result = validate_event_source_mappings(cfg, all_lambda_names)
        
        assert result["ResourceType"] == "Event Source Mapping"
        mock_lambda.list_event_source_mappings.assert_called_once()

    @patch('validators.all_validators.boto3.client')
    def test_validate_event_source_mappings_empty_config(self, mock_boto3_client):
        """Test event source mapping validation with empty configuration"""
        mock_lambda = MagicMock()
        mock_boto3_client.return_value = mock_lambda
        
        cfg = {"EventSourceMappings": []}
        all_lambda_names = set()
        
        result = validate_event_source_mappings(cfg, all_lambda_names)
        
        assert result["ResourceType"] == "Event Source Mapping"
        assert result["DetailedHealthCheck"] == []


class TestValidateLambdaPermissionsComprehensive:
    """Comprehensive tests for validate_lambda_permissions function"""

    @patch('validators.all_validators.boto3.client')
    @patch('validators.all_validators.get_lambda_policy')
    @patch('validators.all_validators.combine_results')
    def test_validate_lambda_permissions_success(self, mock_combine_results, mock_get_lambda_policy, mock_boto3_client):
        """Test successful Lambda permission validation"""
        mock_lambda = MagicMock()
        mock_boto3_client.return_value = mock_lambda
        
        # Mock policy with correct permission
        mock_policy = {
            "Statement": [{
                "Sid": "test-permission",
                "Principal": {"Service": "s3.amazonaws.com"},
                "Action": "lambda:InvokeFunction"
            }]
        }
        mock_get_lambda_policy.return_value = mock_policy
        mock_combine_results.return_value = {"ResourceName": "test-permission", "status": 200}
        
        cfg = {
            "LambdaPermissions": [{
                "name": "test-permission",
                "function": "test-function",
                "principal": "s3.amazonaws.com",
                "source": "arn:aws:s3:::test-bucket"
            }]
        }
        all_lambda_names = {"test-function"}
        
        result = validate_lambda_permissions(cfg, all_lambda_names)
        
        assert result["ResourceType"] == "Lambda Permission"
        mock_get_lambda_policy.assert_called_once_with("test-function", mock_lambda)

    @patch('validators.all_validators.boto3.client')
    @patch('validators.all_validators.get_lambda_policy')
    @patch('validators.all_validators.combine_results')
    def test_validate_lambda_permissions_missing_policy(self, mock_combine_results, mock_get_lambda_policy, mock_boto3_client):
        """Test Lambda permission validation when policy is missing"""
        mock_lambda = MagicMock()
        mock_boto3_client.return_value = mock_lambda
        mock_get_lambda_policy.return_value = None
        mock_combine_results.return_value = {"ResourceName": "test-permission", "status": 500}
        
        cfg = {
            "LambdaPermissions": [{
                "name": "test-permission",
                "function": "test-function",
                "principal": "s3.amazonaws.com",
                "source": "arn:aws:s3:::test-bucket"
            }]
        }
        all_lambda_names = {"test-function"}
        
        result = validate_lambda_permissions(cfg, all_lambda_names)
        
        assert result["ResourceType"] == "Lambda Permission"
        mock_combine_results.assert_called_once_with("test-permission", [(False, "No resource policy found for Lambda 'test-function'")])


class TestValidateRolesComprehensive:
    """Additional comprehensive tests for validate_roles function covering error scenarios"""

    @patch('validators.all_validators.boto3.client')
    def test_validate_roles_sts_exception(self, mock_boto3_client):
        """Test role validation when STS call fails"""
        mock_sts = MagicMock()
        mock_iam = MagicMock()
        mock_boto3_client.side_effect = [mock_sts, mock_iam]
        
        # Mock STS exception
        mock_sts.get_caller_identity.side_effect = Exception("STS Error")
        
        cfg = {
            "IAMRoles": [{
                "resource_name": "TestRole",
                "name": "TestRole",
                "arn": "arn:aws:iam::123456789012:role/TestRole"
            }]
        }
        
        result = validate_roles(cfg)
        
        assert result["ResourceType"] == "IAM Role"
        # Should handle the exception gracefully and set ACCOUNT_ID to "UNKNOWN"

    @patch('validators.all_validators.boto3.client')
    def test_validate_roles_empty_config(self, mock_boto3_client):
        """Test role validation with empty configuration"""
        mock_sts = MagicMock()
        mock_iam = MagicMock()
        mock_boto3_client.side_effect = [mock_sts, mock_iam]
        mock_sts.get_caller_identity.return_value = {"Account": "123456789012"}
        
        cfg = {"IAMRoles": []}
        
        result = validate_roles(cfg)
        
        assert result["ResourceType"] == "IAM Role"
        assert result["DetailedHealthCheck"] == []


class TestGetConnectResourceForRole:
    """Tests for _get_connect_resource_for_role helper function"""

    def test_returns_wildcard_when_no_connect_storage(self):
        """Returns '*' when connect_storage is None"""
        result = _get_connect_resource_for_role("TestRole", ["s3:GetObject"], None, MagicMock())
        assert result == "*"

    def test_returns_wildcard_when_no_health_input(self):
        """Returns '*' when health_input is None"""
        result = _get_connect_resource_for_role("TestRole", ["s3:GetObject"], {"bucket": "test"}, None)
        assert result == "*"

    def test_returns_s3_bucket_arn_for_s3_role(self):
        """Returns S3 bucket ARN for S3-related roles with S3 actions"""
        connect_storage = {'call_recordings_s3_bucket': 'my-recordings-bucket'}
        health_input = MagicMock()
        health_input.sku = 'importxml'
        
        result = _get_connect_resource_for_role(
            "test-SCVS3Role", 
            ["s3:GetObject", "s3:PutObject"], 
            connect_storage, 
            health_input
        )
        assert result == "arn:aws:s3:::my-recordings-bucket/*"

    def test_returns_s3_bucket_arn_for_tenant_bucket_role(self):
        """Returns S3 bucket ARN for SCVTenantBucketWriteAccessRole"""
        connect_storage = {'call_recordings_s3_bucket': 'tenant-bucket'}
        health_input = MagicMock()
        
        result = _get_connect_resource_for_role(
            "prefix-SCVTenantBucketWriteAccessRole", 
            ["s3:PutObject"], 
            connect_storage, 
            health_input
        )
        assert result == "arn:aws:s3:::tenant-bucket/*"

    def test_returns_wildcard_for_s3_role_without_bucket(self):
        """Returns '*' for S3 role when no bucket in connect_storage"""
        connect_storage = {}  # No bucket
        health_input = MagicMock()
        
        result = _get_connect_resource_for_role(
            "test-SCVS3Role", 
            ["s3:GetObject"], 
            connect_storage, 
            health_input
        )
        assert result == "*"

    def test_returns_ctr_stream_arn_for_ctr_role(self):
        """Returns CTR stream ARN for CTRDataSyncFunctionRole"""
        connect_storage = {'ctr_stream_arn': 'arn:aws:kinesis:us-east-1:123456789012:stream/ctr-stream'}
        health_input = MagicMock()
        
        result = _get_connect_resource_for_role(
            "prefix-CTRDataSyncFunctionRole", 
            ["kinesis:GetRecords", "kinesis:GetShardIterator"], 
            connect_storage, 
            health_input
        )
        assert result == "arn:aws:kinesis:us-east-1:123456789012:stream/ctr-stream"

    def test_returns_contact_lens_stream_arn_for_cl_role(self):
        """Returns Contact Lens stream ARN for ContactLensConsumerFunctionRole"""
        connect_storage = {'contact_lens_stream_arn': 'arn:aws:kinesis:us-east-1:123456789012:stream/cl-stream'}
        health_input = MagicMock()
        
        result = _get_connect_resource_for_role(
            "prefix-ContactLensConsumerFunctionRole", 
            ["kinesis:GetRecords"], 
            connect_storage, 
            health_input
        )
        assert result == "arn:aws:kinesis:us-east-1:123456789012:stream/cl-stream"

    def test_returns_wildcard_for_non_matching_role(self):
        """Returns '*' for roles that don't match any pattern"""
        connect_storage = {'call_recordings_s3_bucket': 'bucket'}
        health_input = MagicMock()
        
        result = _get_connect_resource_for_role(
            "SomeOtherRole", 
            ["s3:GetObject"], 
            connect_storage, 
            health_input
        )
        assert result == "*"

    def test_returns_wildcard_for_non_s3_actions_on_s3_role(self):
        """Returns '*' when S3 role has non-S3 actions"""
        connect_storage = {'call_recordings_s3_bucket': 'bucket'}
        health_input = MagicMock()
        
        result = _get_connect_resource_for_role(
            "test-SCVS3Role", 
            ["iam:GetRole"],  # Not S3 actions
            connect_storage, 
            health_input
        )
        assert result == "*"


class TestVerifyRoleHasConnectBucketInPolicy:
    """Tests for _verify_role_has_connect_bucket_in_policy helper function"""

    def test_returns_skip_when_no_cf_bucket_pattern(self):
        """Returns should_check=False when role has no CF bucket pattern"""
        mock_iam = MagicMock()
        mock_iam.list_role_policies.return_value = {"PolicyNames": ["InlinePolicy"]}
        mock_iam.get_role_policy.return_value = {
            "PolicyDocument": {
                "Statement": [{
                    "Effect": "Allow",
                    "Action": ["s3:GetObject"],
                    "Resource": "arn:aws:s3:::other-bucket/*"
                }]
            }
        }
        mock_iam.list_attached_role_policies.return_value = {"AttachedPolicies": []}
        
        success, message, should_check = _verify_role_has_connect_bucket_in_policy(
            "TestRole", "connect-bucket", "cf-pattern-bucket", mock_iam
        )
        
        assert success is True
        assert should_check is False
        assert "no check needed" in message

    def test_returns_success_when_connect_bucket_found(self):
        """Returns success when Connect bucket is found in policy"""
        mock_iam = MagicMock()
        mock_iam.list_role_policies.return_value = {"PolicyNames": ["InlinePolicy"]}
        mock_iam.get_role_policy.return_value = {
            "PolicyDocument": {
                "Statement": [{
                    "Effect": "Allow",
                    "Action": ["s3:GetObject"],
                    "Resource": [
                        "arn:aws:s3:::cf-pattern-bucket/*",
                        "arn:aws:s3:::connect-bucket/*"
                    ]
                }]
            }
        }
        mock_iam.list_attached_role_policies.return_value = {"AttachedPolicies": []}
        
        success, message, should_check = _verify_role_has_connect_bucket_in_policy(
            "TestRole", "connect-bucket", "cf-pattern-bucket", mock_iam
        )
        
        assert success is True
        assert should_check is True
        assert "has Connect bucket" in message

    def test_returns_failure_when_connect_bucket_missing(self):
        """Returns failure when CF bucket found but Connect bucket missing"""
        mock_iam = MagicMock()
        mock_iam.list_role_policies.return_value = {"PolicyNames": ["InlinePolicy"]}
        mock_iam.get_role_policy.return_value = {
            "PolicyDocument": {
                "Statement": [{
                    "Effect": "Allow",
                    "Action": ["s3:GetObject"],
                    "Resource": "arn:aws:s3:::cf-pattern-bucket/*"
                }]
            }
        }
        mock_iam.list_attached_role_policies.return_value = {"AttachedPolicies": []}
        
        success, message, should_check = _verify_role_has_connect_bucket_in_policy(
            "TestRole", "connect-bucket", "cf-pattern-bucket", mock_iam
        )
        
        assert success is False
        assert should_check is True
        assert "MISSING Connect bucket" in message

    def test_wildcard_resource_covers_connect_bucket(self):
        """Wildcard resource '*' should cover Connect bucket"""
        mock_iam = MagicMock()
        mock_iam.list_role_policies.return_value = {"PolicyNames": ["InlinePolicy"]}
        mock_iam.get_role_policy.return_value = {
            "PolicyDocument": {
                "Statement": [{
                    "Effect": "Allow",
                    "Action": ["s3:GetObject"],
                    "Resource": ["arn:aws:s3:::cf-pattern-bucket/*", "*"]
                }]
            }
        }
        mock_iam.list_attached_role_policies.return_value = {"AttachedPolicies": []}
        
        success, message, should_check = _verify_role_has_connect_bucket_in_policy(
            "TestRole", "connect-bucket", "cf-pattern-bucket", mock_iam
        )
        
        assert success is True
        assert should_check is True
        assert "wildcard" in message.lower() or "Connect bucket" in message

    def test_handles_exception_gracefully(self):
        """Handles exceptions gracefully"""
        mock_iam = MagicMock()
        mock_iam.list_role_policies.side_effect = Exception("IAM Error")
        
        success, message, should_check = _verify_role_has_connect_bucket_in_policy(
            "TestRole", "connect-bucket", "cf-pattern-bucket", mock_iam
        )
        
        assert success is False
        assert should_check is True
        assert "Could not verify" in message

    def test_checks_attached_policies(self):
        """Checks attached policies for Connect bucket"""
        mock_iam = MagicMock()
        mock_iam.list_role_policies.return_value = {"PolicyNames": []}
        mock_iam.list_attached_role_policies.return_value = {
            "AttachedPolicies": [{"PolicyName": "AttachedPolicy", "PolicyArn": "arn:aws:iam::123:policy/test"}]
        }
        mock_iam.get_policy.return_value = {"Policy": {"DefaultVersionId": "v1"}}
        mock_iam.get_policy_version.return_value = {
            "PolicyVersion": {
                "Document": {
                    "Statement": [{
                        "Effect": "Allow",
                        "Action": ["s3:GetObject"],
                        "Resource": [
                            "arn:aws:s3:::cf-pattern-bucket/*",
                            "arn:aws:s3:::connect-bucket/*"
                        ]
                    }]
                }
            }
        }
        
        success, message, should_check = _verify_role_has_connect_bucket_in_policy(
            "TestRole", "connect-bucket", "cf-pattern-bucket", mock_iam
        )
        
        assert success is True
        assert should_check is True


class TestVerifyS3BucketMatchesConnectImportXml:
    """Tests for _verify_s3_bucket_matches_connect with ImportXML/MultiOrg SKUs"""

    @patch('validators.all_validators.boto3.client')
    def test_importxml_accepts_different_connect_bucket(self, mock_boto3_client):
        """For ImportXML, different Connect bucket is accepted as source of truth"""
        mock_s3 = MagicMock()
        mock_boto3_client.return_value = mock_s3
        
        health_input = MagicMock()
        health_input.sku = 'importxml'
        
        connect_storage = {'call_recordings_s3_bucket': 'connect-configured-bucket'}
        
        success, message = _verify_s3_bucket_matches_connect(
            'expected-bucket', connect_storage, health_input
        )
        
        assert success is True
        assert "source of truth" in message

    @patch('validators.all_validators.boto3.client')
    def test_multiorg_accepts_different_connect_bucket(self, mock_boto3_client):
        """For MultiOrg, different Connect bucket is accepted as source of truth"""
        mock_s3 = MagicMock()
        mock_boto3_client.return_value = mock_s3
        
        health_input = MagicMock()
        health_input.sku = 'multiorg'
        
        connect_storage = {'call_recordings_s3_bucket': 'connect-configured-bucket'}
        
        success, message = _verify_s3_bucket_matches_connect(
            'expected-bucket', connect_storage, health_input
        )
        
        assert success is True
        assert "source of truth" in message

    def test_non_importxml_rejects_mismatch(self):
        """For non-ImportXML SKUs, bucket mismatch is an error"""
        health_input = MagicMock()
        health_input.sku = 'byoa'
        
        connect_storage = {'call_recordings_s3_bucket': 'different-bucket'}
        
        success, message = _verify_s3_bucket_matches_connect(
            'expected-bucket', connect_storage, health_input
        )
        
        assert success is False
        assert "mismatch" in message

    def test_matching_buckets_always_succeed(self):
        """When buckets match, always return success regardless of SKU"""
        health_input = MagicMock()
        health_input.sku = 'byoa'
        
        connect_storage = {'call_recordings_s3_bucket': 'same-bucket'}
        
        success, message = _verify_s3_bucket_matches_connect(
            'same-bucket', connect_storage, health_input
        )
        
        assert success is True
        assert "matches" in message

    def test_no_connect_bucket_returns_error(self):
        """When no Connect bucket configured, return error"""
        health_input = MagicMock()
        health_input.sku = 'importxml'
        
        connect_storage = {}  # No bucket
        
        success, message = _verify_s3_bucket_matches_connect(
            'expected-bucket', connect_storage, health_input
        )
        
        assert success is False
        assert "No call recordings bucket" in message

    @patch('validators.all_validators.boto3.client')
    def test_importxml_connect_bucket_not_exists(self, mock_boto3_client):
        """For ImportXML, error if Connect bucket doesn't exist"""
        from botocore.exceptions import ClientError
        
        mock_s3 = MagicMock()
        mock_boto3_client.return_value = mock_s3
        mock_s3.head_bucket.side_effect = ClientError(
            {'Error': {'Code': '404'}}, 'HeadBucket'
        )
        
        health_input = MagicMock()
        health_input.sku = 'importxml'
        
        connect_storage = {'call_recordings_s3_bucket': 'nonexistent-bucket'}
        
        success, message = _verify_s3_bucket_matches_connect(
            'expected-bucket', connect_storage, health_input
        )
        
        assert success is False
        assert "does not exist" in message

    @patch('validators.all_validators.boto3.client')
    def test_importxml_connect_bucket_access_denied(self, mock_boto3_client):
        """For ImportXML, error if no access to Connect bucket"""
        from botocore.exceptions import ClientError
        
        mock_s3 = MagicMock()
        mock_boto3_client.return_value = mock_s3
        mock_s3.head_bucket.side_effect = ClientError(
            {'Error': {'Code': '403'}}, 'HeadBucket'
        )
        
        health_input = MagicMock()
        health_input.sku = 'importxml'
        
        connect_storage = {'call_recordings_s3_bucket': 'no-access-bucket'}
        
        success, message = _verify_s3_bucket_matches_connect(
            'expected-bucket', connect_storage, health_input
        )
        
        assert success is False
        assert "No access" in message


class TestValidateS3ImportXmlMultiOrg:
    """Tests for validate_s3 with ImportXML/MultiOrg SKU handling"""

    @patch('validators.all_validators.boto3.client')
    def test_importxml_uses_connect_bucket_as_source_of_truth(self, mock_boto3_client):
        """For ImportXML, Connect-configured bucket is validated as source of truth"""
        mock_s3 = MagicMock()
        mock_boto3_client.return_value = mock_s3
        
        with patch('validators.all_validators.s3_bucket_exists') as mock_bucket_exists, \
             patch('validators.all_validators.combine_results') as mock_combine, \
             patch('utils.stream_discovery.discover_connect_s3_storage') as mock_discover:
            
            mock_bucket_exists.return_value = (True, "Bucket exists")
            mock_combine.return_value = {"ResourceName": "bucket", "status": 200}
            mock_discover.return_value = {'call_recordings_s3_bucket': 'connect-bucket'}
            
            health_input = MagicMock()
            health_input.sku = 'importxml'
            health_input.connect_instance_id = 'test-instance'
            
            cfg = {
                "S3Buckets": [{
                    "resource_name": "S3Bucket",
                    "name": "cf-bucket"  # Different from Connect bucket
                }]
            }
            
            result = validate_s3(cfg, health_input)
            
            assert result["ResourceType"] == "S3 Bucket"
            mock_discover.assert_called_once_with('test-instance')

    @patch('validators.all_validators.boto3.client')
    def test_non_s3bucket_resource_uses_standard_validation(self, mock_boto3_client):
        """Non-S3Bucket resources use standard validation even for ImportXML"""
        mock_s3 = MagicMock()
        mock_boto3_client.return_value = mock_s3
        
        with patch('validators.all_validators.s3_bucket_exists') as mock_bucket_exists, \
             patch('validators.all_validators.combine_results') as mock_combine:
            
            mock_bucket_exists.return_value = (True, "Bucket exists")
            mock_combine.return_value = {"ResourceName": "bucket", "status": 200}
            
            health_input = MagicMock()
            health_input.sku = 'importxml'
            health_input.connect_instance_id = 'test-instance'
            
            cfg = {
                "S3Buckets": [{
                    "resource_name": "CloudTrailBucket",  # Not S3Bucket
                    "name": "cloudtrail-bucket"
                }]
            }
            
            result = validate_s3(cfg, health_input)
            
            assert result["ResourceType"] == "S3 Bucket"
            # Should validate the CloudTrail bucket normally
            mock_bucket_exists.assert_called_once_with('cloudtrail-bucket', mock_s3)


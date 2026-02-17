"""
Extended tests for utils/aws_helpers.py to improve coverage.
"""

import pytest
from unittest.mock import MagicMock, patch
from botocore.exceptions import ClientError

from utils.aws_helpers import (
    lambda_exists,
    alias_exists,
    layers_attached,
    lambda_role_correct,
    simulate_actions
)


class TestLambdaExists:
    """Test lambda_exists function."""

    def test_lambda_exists_success(self):
        """Test lambda_exists when function exists."""
        mock_client = MagicMock()
        mock_client.get_function.return_value = {"Configuration": {"FunctionName": "test-function"}}
        
        result, message = lambda_exists("test-function", mock_client)
        
        assert result is True
        assert message == "healthy"
        mock_client.get_function.assert_called_once_with(FunctionName="test-function")

    def test_lambda_exists_not_found(self):
        """Test lambda_exists when function doesn't exist."""
        mock_client = MagicMock()
        mock_client.get_function.side_effect = ClientError(
            {'Error': {'Code': 'ResourceNotFoundException'}}, 'GetFunction'
        )
        
        result, message = lambda_exists("missing-function", mock_client)
        
        assert result is False
        assert "missing" in message
        assert "missing-function" in message

    def test_lambda_exists_other_error(self):
        """Test lambda_exists with other AWS error."""
        mock_client = MagicMock()
        mock_client.get_function.side_effect = ClientError(
            {'Error': {'Code': 'AccessDeniedException'}}, 'GetFunction'
        )
        
        result, message = lambda_exists("error-function", mock_client)
        
        assert result is False
        assert "error" in message
        assert "AccessDeniedException" in message


class TestAliasExists:
    """Test alias_exists function."""

    def test_alias_exists_success(self):
        """Test alias_exists when alias exists."""
        mock_client = MagicMock()
        mock_client.get_alias.return_value = {"Name": "prod", "FunctionName": "test-function"}
        
        result, message = alias_exists("test-function", "prod", mock_client)
        
        assert result is True
        assert message == "Alias exists."
        mock_client.get_alias.assert_called_once_with(FunctionName="test-function", Name="prod")

    def test_alias_exists_not_found(self):
        """Test alias_exists when alias doesn't exist."""
        mock_client = MagicMock()
        mock_client.get_alias.side_effect = ClientError(
            {'Error': {'Code': 'ResourceNotFoundException'}}, 'GetAlias'
        )
        
        result, message = alias_exists("test-function", "missing", mock_client)
        
        assert result is False
        assert "missing" in message
        assert "missing" in message

    def test_alias_exists_other_error(self):
        """Test alias_exists with other AWS error."""
        mock_client = MagicMock()
        mock_client.get_alias.side_effect = ClientError(
            {'Error': {'Code': 'AccessDeniedException'}}, 'GetAlias'
        )
        
        result, message = alias_exists("test-function", "error", mock_client)
        
        assert result is False
        assert "error" in message
        assert "AccessDeniedException" in message


class TestLayersAttached:
    """Test layers_attached function."""

    def test_layers_attached_no_layers_expected(self):
        """Test layers_attached when no layers are expected."""
        mock_client = MagicMock()
        mock_client.get_function.return_value = {
            "Configuration": {
                "Layers": []
            }
        }
        
        result, message = layers_attached("test-function", [], mock_client)
        
        assert result is True
        assert "No layers expected" in message

    def test_layers_attached_with_alias(self):
        """Test layers_attached with function alias."""
        mock_client = MagicMock()
        mock_client.get_function_configuration.return_value = {
            "Layers": [
                {"Arn": "arn:aws:lambda:us-west-2:123456789012:layer:test-layer:1"}
            ]
        }
        
        expected_layers = ["test-layer"]  # Just the layer name, not full ARN
        result, message = layers_attached("test-function", expected_layers, mock_client, alias="prod")
        
        assert result is True
        mock_client.get_function_configuration.assert_called_once_with(FunctionName="test-function", Qualifier="prod")

    def test_layers_attached_mismatch(self):
        """Test layers_attached when layers don't match."""
        mock_client = MagicMock()
        mock_client.get_function_configuration.return_value = {
            "Layers": [
                {"Arn": "arn:aws:lambda:us-west-2:123456789012:layer:wrong-layer:1"}
            ]
        }
        
        expected_layers = ["expected-layer"]
        result, message = layers_attached("test-function", expected_layers, mock_client)
        
        assert result is False
        assert "Layers missing from test-function" in message

    def test_layers_attached_client_error(self):
        """Test layers_attached with client error."""
        mock_client = MagicMock()
        mock_client.get_function_configuration.side_effect = ClientError(
            {'Error': {'Code': 'ResourceNotFoundException'}}, 'GetFunctionConfiguration'
        )
        
        result, message = layers_attached("missing-function", ["some-layer"], mock_client)
        
        assert result is False
        assert "Error retrieving layers" in message


class TestLambdaRoleCorrect:
    """Test lambda_role_correct function."""

    def test_lambda_role_correct_match(self):
        """Test lambda_role_correct when roles match."""
        mock_client = MagicMock()
        mock_client.get_function.return_value = {
            "Configuration": {
                "Role": "arn:aws:iam::123456789012:role/test-role"
            }
        }
        
        result, message = lambda_role_correct("test-function", "arn:aws:iam::123456789012:role/test-role", mock_client)
        
        assert result is True
        assert "Execution role is correct" in message

    def test_lambda_role_correct_mismatch(self):
        """Test lambda_role_correct when roles don't match."""
        mock_client = MagicMock()
        mock_client.get_function.return_value = {
            "Configuration": {
                "Role": "arn:aws:iam::123456789012:role/wrong-role"
            }
        }
        
        result, message = lambda_role_correct("test-function", "arn:aws:iam::123456789012:role/expected-role", mock_client)
        
        assert result is False
        assert "Role mismatch" in message

    def test_lambda_role_correct_no_expected_role(self):
        """Test lambda_role_correct when no role is expected."""
        mock_client = MagicMock()
        
        result, message = lambda_role_correct("test-function", None, mock_client)
        
        assert result is True
        assert "No execution role expected" in message
        mock_client.get_function.assert_not_called()

    def test_lambda_role_correct_client_error(self):
        """Test lambda_role_correct with client error."""
        mock_client = MagicMock()
        mock_client.get_function.side_effect = ClientError(
            {'Error': {'Code': 'AccessDeniedException'}}, 'GetFunction'
        )
        
        result, message = lambda_role_correct("error-function", "arn:aws:iam::123456789012:role/test-role", mock_client)
        
        assert result is False
        assert "Error checking role for error-function" in message
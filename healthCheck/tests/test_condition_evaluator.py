"""
Tests for condition evaluator utilities.
"""

import os
import unittest
from unittest.mock import patch

from utils.condition_evaluator import (
    evaluate_condition, resolve_resource_name, resolve_placeholders,
    should_validate_resource, get_resolved_resource_name
)


class TestEvaluateCondition(unittest.TestCase):
    """Test condition evaluation logic."""
    
    def test_not_customer_configured_s3_bucket_name_true(self):
        """Test NOT_CustomerConfiguredS3BucketName condition when customer bucket is empty (SCV-managed)."""
        with patch.dict(os.environ, {"CUSTOMER_CONFIGURED_S3_BUCKET_NAME": ""}):
            result = evaluate_condition("NOT_CustomerConfiguredS3BucketName")
            assert result is True  # Empty string = SCV creates the bucket
    
    def test_not_customer_configured_s3_bucket_name_false(self):
        """Test NOT_CustomerConfiguredS3BucketName condition when customer bucket is provided (customer provides bucket)."""
        with patch.dict(os.environ, {"CUSTOMER_CONFIGURED_S3_BUCKET_NAME": "my-custom-bucket"}):
            result = evaluate_condition("NOT_CustomerConfiguredS3BucketName")
            assert result is False  # Non-empty string = customer provides their own bucket
    
    def test_customer_configured_s3_bucket_name_true(self):
        """Test CustomerConfiguredS3BucketName condition when customer bucket is provided (customer-configured)."""
        with patch.dict(os.environ, {"CUSTOMER_CONFIGURED_S3_BUCKET_NAME": "my-custom-bucket"}):
            result = evaluate_condition("CustomerConfiguredS3BucketName")
            assert result is True  # Non-empty string = customer provides their own bucket
    
    def test_customer_configured_s3_bucket_name_false(self):
        """Test CustomerConfiguredS3BucketName condition when customer bucket is empty (SCV-managed)."""
        with patch.dict(os.environ, {"CUSTOMER_CONFIGURED_S3_BUCKET_NAME": ""}):
            result = evaluate_condition("CustomerConfiguredS3BucketName")
            assert result is False
    
    def test_lambda_prefix_conditions(self):
        """Test LambdaPrefix and NOT_LambdaPrefix conditions."""
        # Test with prefix
        with patch.dict(os.environ, {"LAMBDA_PREFIX": "myprefix"}):
            assert evaluate_condition("LambdaPrefix") is True
            assert evaluate_condition("NOT_LambdaPrefix") is False
        
        # Test without prefix
        with patch.dict(os.environ, {"LAMBDA_PREFIX": ""}):
            assert evaluate_condition("LambdaPrefix") is False
            assert evaluate_condition("NOT_LambdaPrefix") is True
    
    def test_unknown_condition_defaults_true(self):
        """Test that unknown conditions default to True."""
        result = evaluate_condition("UnknownCondition")
        assert result is True
    
    # InstanceType tests removed - conditions are now handled by resource generator


class TestResolveResourceName(unittest.TestCase):
    """Test resource name resolution logic."""
    
    def test_simple_name_no_conditional(self):
        """Test simple resource name without conditional logic."""
        env_vars = {
            "S3_BUCKET_FOR_TENANT_RESOURCES": "scv-tenant-bucket",
            "AWS_ACCOUNT_ID": "123456789012"
        }
        with patch.dict(os.environ, env_vars):
            result = resolve_resource_name("${S3BucketForTenantResources}-${AWS::AccountId}")
            assert result == "scv-tenant-bucket-123456789012"
    
    def test_conditional_name_scv_managed(self):
        """Test conditional resource name for SCV-managed scenario."""
        env_vars = {
            "CUSTOMER_CONFIGURED_S3_BUCKET_NAME": "",  # Empty = SCV-managed
            "S3_BUCKET_FOR_TENANT_RESOURCES": "scv-tenant-bucket",
            "AWS_ACCOUNT_ID": "123456789012"
        }
        with patch.dict(os.environ, env_vars):
            result = resolve_resource_name("${S3BucketForTenantResources}-${AWS::AccountId}|${CustomerConfiguredS3BucketName}")
            assert result == "scv-tenant-bucket-123456789012"
    
    def test_conditional_name_customer_configured(self):
        """Test conditional resource name for customer-configured scenario."""
        env_vars = {
            "CUSTOMER_CONFIGURED_S3_BUCKET_NAME": "my-custom-bucket",  # Not empty = customer-configured
            "S3_BUCKET_FOR_TENANT_RESOURCES": "scv-tenant-bucket",
            "AWS_ACCOUNT_ID": "123456789012"
        }
        with patch.dict(os.environ, env_vars):
            # Note: The logic uses DoCreateS3Bucket condition internally, which is True when customer bucket is empty
            # Since customer bucket is NOT empty, DoCreateS3Bucket is False, so use second option
            result = resolve_resource_name("${S3BucketForTenantResources}-${AWS::AccountId}|${CustomerConfiguredS3BucketName}")
            assert result == "my-custom-bucket"


class TestResolvePlaceholders(unittest.TestCase):
    """Test placeholder resolution logic."""
    
    def test_resolve_multiple_placeholders(self):
        """Test resolving multiple placeholders in a string."""
        env_vars = {
            "CALL_CENTER_API_NAME": "test-api",
            "AWS_ACCOUNT_ID": "123456789012"
        }
        with patch.dict(os.environ, env_vars):
            result = resolve_placeholders("${CallCenterApiName}-bucket-${AWS::AccountId}")
            assert result == "test-api-bucket-123456789012"
    
    def test_resolve_missing_placeholder(self):
        """Test resolving placeholders when environment variable is missing."""
        with patch.dict(os.environ, {}, clear=True):
            result = resolve_placeholders("${MissingVar}-test")
            assert result == "${MissingVar}-test"  # Should remain unchanged


class TestShouldValidateResource(unittest.TestCase):
    """Test resource validation decision logic."""
    
    def test_no_condition_always_validate(self):
        """Test that resources without conditions are always validated."""
        resource = {
            "resource_name": "TestResource",
            "name": "test-resource"
        }
        result = should_validate_resource(resource)
        assert result is True
    
    def test_condition_true_validate(self):
        """Test that resources with true conditions are validated."""
        with patch.dict(os.environ, {"CUSTOMER_CONFIGURED_S3_BUCKET_NAME": ""}):
            resource = {
                "resource_name": "S3BucketCorsConfigurationFunction",
                "name": "test-function",
                "condition": "NOT_CustomerConfiguredS3BucketName"
            }
            result = should_validate_resource(resource)
            assert result is True
    
    def test_condition_false_skip(self):
        """Test that resources with false conditions are skipped."""
        with patch.dict(os.environ, {"CUSTOMER_CONFIGURED_S3_BUCKET_NAME": "my-custom-bucket"}):
            resource = {
                "resource_name": "S3BucketCorsConfigurationFunction",
                "name": "test-function",
                "condition": "NOT_CustomerConfiguredS3BucketName"
            }
            result = should_validate_resource(resource)
            assert result is False
    
    def test_implicit_condition_true_validate(self):
        """Test that resources with implicit conditions are validated when condition is true."""
        with patch.dict(os.environ, {"CUSTOMER_CONFIGURED_S3_BUCKET_NAME": ""}):
            resource = {
                "resource_name": "S3BucketCorsConfigurationFunction",
                "name": "test-function"
                # No explicit condition field
            }
            result = should_validate_resource(resource)
            assert result is True
    
    def test_implicit_condition_false_skip(self):
        """Test that resources with implicit conditions are skipped when condition is false."""
        with patch.dict(os.environ, {"CUSTOMER_CONFIGURED_S3_BUCKET_NAME": "my-custom-bucket"}):
            resource = {
                "resource_name": "S3BucketCorsConfigurationFunction",
                "name": "test-function"
                # No explicit condition field
            }
            result = should_validate_resource(resource)
            assert result is False
    
    def test_implicit_eventbridge_condition_true_validate(self):
        """Test that EventBridge function is validated when customer provides bucket."""
        with patch.dict(os.environ, {"CUSTOMER_CONFIGURED_S3_BUCKET_NAME": "my-custom-bucket"}):
            resource = {
                "resource_name": "S3BucketEventBridgeConfigurationFunction",
                "name": "test-function"
                # No explicit condition field
            }
            result = should_validate_resource(resource)
            assert result is True
    
    def test_implicit_eventbridge_condition_false_skip(self):
        """Test that EventBridge function is skipped when SCV manages bucket."""
        with patch.dict(os.environ, {"CUSTOMER_CONFIGURED_S3_BUCKET_NAME": ""}):
            resource = {
                "resource_name": "S3BucketEventBridgeConfigurationFunction",
                "name": "test-function"
                # No explicit condition field
            }
            result = should_validate_resource(resource)
            assert result is False


class TestGetResolvedResourceName(unittest.TestCase):
    """Test resolved resource name logic."""
    
    def test_get_resolved_name_with_condition(self):
        """Test getting resolved resource name with conditional logic."""
        env_vars = {
            "CUSTOMER_CONFIGURED_S3_BUCKET_NAME": "",
            "S3_BUCKET_FOR_TENANT_RESOURCES": "scv-tenant-bucket",
            "AWS_ACCOUNT_ID": "123456789012"
        }
        with patch.dict(os.environ, env_vars):
            resource = {
                "resource_name": "S3Bucket",
                "name": "${S3BucketForTenantResources}-${AWS::AccountId}|${CustomerConfiguredS3BucketName}",
                "condition": "NOT_CustomerConfiguredS3BucketName"
            }
            result = get_resolved_resource_name(resource)
            assert result == "scv-tenant-bucket-123456789012"

    def test_get_resolved_resource_name_invalid_conditional_format(self):
        """Test get_resolved_resource_name with invalid conditional format"""
        resource = {
            "name": "invalid|format|too|many|options",
            "resource_name": "TestResource"
        }
        
        result = get_resolved_resource_name(resource)
        
        # Should return the resolved name as-is when format is invalid
        assert "invalid" in result

    def test_get_resolved_resource_name_option1_customer_configured(self):
        """Test get_resolved_resource_name when option1 has customer configuration"""
        resource = {
            "name": "${CustomerConfiguredS3BucketName}|scv-${AWS::AccountId}",
            "resource_name": "TestResource"
        }
        
        # Mock environment to have customer configured bucket
        with patch.dict(os.environ, {
            'CUSTOMER_CONFIGURED_S3_BUCKET_NAME': 'customer-bucket',
            'AWS_ACCOUNT_ID': '123456789012'
        }):
            result = get_resolved_resource_name(resource)
        
        assert result == "customer-bucket"

    def test_get_resolved_resource_name_option2_customer_configured(self):
        """Test get_resolved_resource_name when option2 has customer configuration"""
        resource = {
            "name": "scv-${AWS::AccountId}|${CustomerConfiguredS3BucketName}",
            "resource_name": "TestResource"
        }
        
        # Mock environment to have customer configured bucket
        with patch.dict(os.environ, {
            'CUSTOMER_CONFIGURED_S3_BUCKET_NAME': 'customer-bucket-option2',
            'AWS_ACCOUNT_ID': '123456789012'
        }):
            result = get_resolved_resource_name(resource)
        
        assert result == "customer-bucket-option2"

    def test_get_resolved_resource_name_fallback_to_option1(self):
        """Test get_resolved_resource_name fallback to option1 when no customer config"""
        resource = {
            "name": "scv-${AWS::AccountId}|backup-${AWS::AccountId}",
            "resource_name": "TestResource"
        }
        
        # Mock environment without customer config
        with patch.dict(os.environ, {
            'AWS_ACCOUNT_ID': '123456789012'
        }, clear=True):
            result = get_resolved_resource_name(resource)
        
        # Should fallback to option1 when no customer config is detected
        assert result == "scv-123456789012"


if __name__ == '__main__':
    unittest.main()
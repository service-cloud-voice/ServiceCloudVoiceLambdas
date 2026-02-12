"""
Tests for health check data models
"""

import pytest
from enum import Enum

# Import the module under test
import sys
sys.path.insert(0, '/Users/tkuwar/opt/workspace/aws-integration/lambdas/healthCheck')

from models.health_models import HealthStatus, HealthCheckInput, ResourceHealthResult


class TestHealthStatus:
    """Test cases for HealthStatus enum"""

    def test_health_status_values(self):
        """Test that HealthStatus enum has correct values"""
        assert HealthStatus.HEALTHY.value == "HEALTHY"
        assert HealthStatus.UNHEALTHY.value == "UNHEALTHY"
        assert HealthStatus.WARNING.value == "WARNING"
        assert HealthStatus.UNKNOWN.value == "UNKNOWN"

    def test_health_status_is_enum(self):
        """Test that HealthStatus is an Enum"""
        assert issubclass(HealthStatus, Enum)
        assert len(HealthStatus) == 4


class TestHealthCheckInput:
    """Test cases for HealthCheckInput dataclass"""

    def test_health_check_input_creation_required_fields(self):
        """Test creating HealthCheckInput with required fields only"""
        health_input = HealthCheckInput(
            cc_version="19.0",
            cc_name="ServiceCloudVoice",
            sku="resell",
            connect_instance_arn="arn:aws:connect:us-west-2:123456789012:instance/12345678-1234-1234-1234-123456789012"
        )
        
        assert health_input.cc_version == "19.0"
        assert health_input.cc_name == "ServiceCloudVoice"
        assert health_input.sku == "resell"
        assert health_input.connect_instance_arn == "arn:aws:connect:us-west-2:123456789012:instance/12345678-1234-1234-1234-123456789012"
        
        # Check defaults
        assert health_input.execution_id is None  # Now optional
        assert health_input.region is None  # Extracted from ARN
        assert health_input.connect_instance_id is None  # Extracted from ARN
        assert health_input.account_id is None
        assert health_input.partition is None
        assert health_input.lambda_prefix is None
        assert health_input.call_center_api_name is None
        assert health_input.s3_bucket_for_tenant_resources is None  # From env var
        assert health_input.s3_bucket_for_reports is None  # From env var
        assert health_input.include_detailed_errors == True
        assert health_input.max_threads == 10

    def test_health_check_input_creation_all_fields(self):
        """Test creating HealthCheckInput with all fields"""
        health_input = HealthCheckInput(
            cc_version="19.0",
            cc_name="ServiceCloudVoice",
            sku="resell",
            connect_instance_arn="arn:aws:connect:us-west-2:123456789012:instance/12345678-1234-1234-1234-123456789012",
            execution_id="exec-123-456",
            region="us-west-2",
            connect_instance_id="12345678-1234-1234-1234-123456789012",
            account_id="123456789012",
            partition="aws",
            lambda_prefix="MyOrg",
            call_center_api_name="ServiceCloudVoice",
            s3_bucket_for_tenant_resources="tenant-resources-bucket",
            s3_bucket_for_reports="reports-bucket",
            include_detailed_errors=False,
            max_threads=5
        )
        
        assert health_input.cc_version == "19.0"
        assert health_input.cc_name == "ServiceCloudVoice"
        assert health_input.sku == "resell"
        assert health_input.connect_instance_arn == "arn:aws:connect:us-west-2:123456789012:instance/12345678-1234-1234-1234-123456789012"
        assert health_input.execution_id == "exec-123-456"
        assert health_input.region == "us-west-2"
        assert health_input.connect_instance_id == "12345678-1234-1234-1234-123456789012"
        assert health_input.account_id == "123456789012"
        assert health_input.partition == "aws"
        assert health_input.lambda_prefix == "MyOrg"
        assert health_input.call_center_api_name == "ServiceCloudVoice"
        assert health_input.s3_bucket_for_tenant_resources == "tenant-resources-bucket"
        assert health_input.s3_bucket_for_reports == "reports-bucket"
        assert health_input.include_detailed_errors == False
        assert health_input.max_threads == 5

    def test_health_check_input_is_dataclass(self):
        """Test that HealthCheckInput is a dataclass"""
        health_input = HealthCheckInput(
            cc_version="19.0",
            cc_name="ServiceCloudVoice",
            sku="resell",
            connect_instance_arn="arn:aws:connect:us-west-2:123456789012:instance/12345678-1234-1234-1234-123456789012"
        )
        
        # Test dataclass properties
        assert hasattr(health_input, '__dataclass_fields__')
        assert len(health_input.__dataclass_fields__) == 15  # Total number of fields (added s3_bucket_for_reports)

    def test_health_check_input_different_sku_types(self):
        """Test HealthCheckInput with different SKU types"""
        for sku_type in ["resell", "byoa", "enterprise"]:
            health_input = HealthCheckInput(
                cc_version="19.0",
                cc_name="ServiceCloudVoice",
                sku=sku_type,
                connect_instance_arn="arn:aws:connect:us-west-2:123456789012:instance/12345678-1234-1234-1234-123456789012"
            )
            assert health_input.sku == sku_type

    def test_health_check_input_different_partitions(self):
        """Test HealthCheckInput with different AWS partitions"""
        test_cases = [
            ("arn:aws:connect:us-west-2:123456789012:instance/12345678-1234-1234-1234-123456789012", "aws"),
            ("arn:aws-cn:connect:cn-north-1:123456789012:instance/12345678-1234-1234-1234-123456789012", "aws-cn"),
            ("arn:aws-us-gov:connect:us-gov-west-1:123456789012:instance/12345678-1234-1234-1234-123456789012", "aws-us-gov")
        ]
        
        for arn, expected_partition in test_cases:
            health_input = HealthCheckInput(
                cc_version="19.0",
                cc_name="ServiceCloudVoice",
                sku="resell",
                connect_instance_arn=arn,
                partition=expected_partition
            )
            assert health_input.connect_instance_arn == arn
            assert health_input.partition == expected_partition


class TestResourceHealthResult:
    """Test cases for ResourceHealthResult dataclass"""

    def test_resource_health_result_creation(self):
        """Test creating ResourceHealthResult"""
        result = ResourceHealthResult(
            resource_name="TestResource",
            resource_type="TestType",
            status=HealthStatus.HEALTHY,
            message="All good",
            details={"check1": "pass", "check2": "pass"}
        )
        
        assert result.resource_name == "TestResource"
        assert result.resource_type == "TestType"
        assert result.status == HealthStatus.HEALTHY
        assert result.message == "All good"
        assert result.details == {"check1": "pass", "check2": "pass"}

    def test_resource_health_result_minimal(self):
        """Test creating ResourceHealthResult with minimal fields"""
        result = ResourceHealthResult(
            resource_name="TestResource",
            resource_type="TestType",
            status=HealthStatus.UNHEALTHY,
            message="Something wrong"
        )
        
        assert result.resource_name == "TestResource"
        assert result.resource_type == "TestType"
        assert result.status == HealthStatus.UNHEALTHY
        assert result.message == "Something wrong"
        assert result.details is None  # Default value

    def test_resource_health_result_with_all_status_values(self):
        """Test ResourceHealthResult with different status values"""
        statuses = [HealthStatus.HEALTHY, HealthStatus.UNHEALTHY, HealthStatus.WARNING, HealthStatus.UNKNOWN]
        
        for status in statuses:
            result = ResourceHealthResult(
                resource_name="TestResource",
                resource_type="TestType",
                status=status,
                message=f"Status is {status.value}"
            )
            assert result.status == status
            assert status.value in result.message
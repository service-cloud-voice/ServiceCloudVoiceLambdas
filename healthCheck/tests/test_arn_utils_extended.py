"""
Extended tests for utils/arn_utils.py to improve coverage.
"""

import pytest
from utils.arn_utils import (
    parse_connect_instance_arn, 
    validate_arn_format, 
    extract_region_from_arn, 
    extract_account_id_from_arn
)


class TestParseConnectInstanceArn:
    """Test parse_connect_instance_arn function."""

    def test_parse_connect_instance_arn_valid(self):
        """Test parsing a valid Connect instance ARN."""
        arn = "arn:aws:connect:us-west-2:123456789012:instance/12345678-1234-1234-1234-123456789012"
        
        result = parse_connect_instance_arn(arn)
        
        assert result["partition"] == "aws"
        assert result["region"] == "us-west-2"
        assert result["account_id"] == "123456789012"
        assert result["instance_id"] == "12345678-1234-1234-1234-123456789012"

    def test_parse_connect_instance_arn_empty(self):
        """Test parsing empty ARN."""
        with pytest.raises(ValueError, match="ARN cannot be empty"):
            parse_connect_instance_arn("")

    def test_parse_connect_instance_arn_none(self):
        """Test parsing None ARN."""
        with pytest.raises(ValueError, match="ARN cannot be empty"):
            parse_connect_instance_arn(None)

    def test_parse_connect_instance_arn_invalid_format(self):
        """Test parsing ARN with invalid format."""
        invalid_arn = "arn:aws:s3:::my-bucket"
        
        with pytest.raises(ValueError, match="Invalid Connect instance ARN format"):
            parse_connect_instance_arn(invalid_arn)

    def test_parse_connect_instance_arn_empty_partition(self):
        """Test parsing ARN with empty partition."""
        invalid_arn = "arn::connect:us-west-2:123456789012:instance/12345678-1234-1234-1234-123456789012"
        
        with pytest.raises(ValueError, match="Invalid Connect instance ARN format"):
            parse_connect_instance_arn(invalid_arn)

    def test_parse_connect_instance_arn_empty_region(self):
        """Test parsing ARN with empty region."""
        invalid_arn = "arn:aws:connect::123456789012:instance/12345678-1234-1234-1234-123456789012"
        
        with pytest.raises(ValueError, match="Invalid Connect instance ARN format"):
            parse_connect_instance_arn(invalid_arn)

    def test_parse_connect_instance_arn_empty_account(self):
        """Test parsing ARN with empty account ID."""
        invalid_arn = "arn:aws:connect:us-west-2::instance/12345678-1234-1234-1234-123456789012"
        
        with pytest.raises(ValueError, match="Invalid Connect instance ARN format"):
            parse_connect_instance_arn(invalid_arn)

    def test_parse_connect_instance_arn_empty_instance_id(self):
        """Test parsing ARN with empty instance ID."""
        invalid_arn = "arn:aws:connect:us-west-2:123456789012:instance/"
        
        with pytest.raises(ValueError, match="Invalid Connect instance ARN format"):
            parse_connect_instance_arn(invalid_arn)

    def test_parse_connect_instance_arn_invalid_uuid(self):
        """Test parsing ARN with invalid UUID format for instance ID."""
        invalid_arn = "arn:aws:connect:us-west-2:123456789012:instance/invalid-uuid"
        
        with pytest.raises(ValueError, match="Invalid Connect instance ID format"):
            parse_connect_instance_arn(invalid_arn)

    def test_parse_connect_instance_arn_govcloud(self):
        """Test parsing GovCloud Connect instance ARN."""
        arn = "arn:aws-us-gov:connect:us-gov-west-1:123456789012:instance/12345678-1234-1234-1234-123456789012"
        
        result = parse_connect_instance_arn(arn)
        
        assert result["partition"] == "aws-us-gov"
        assert result["region"] == "us-gov-west-1"
        assert result["account_id"] == "123456789012"
        assert result["instance_id"] == "12345678-1234-1234-1234-123456789012"

    def test_parse_connect_instance_arn_china(self):
        """Test parsing China Connect instance ARN."""
        arn = "arn:aws-cn:connect:cn-north-1:123456789012:instance/12345678-1234-1234-1234-123456789012"
        
        result = parse_connect_instance_arn(arn)
        
        assert result["partition"] == "aws-cn"
        assert result["region"] == "cn-north-1"
        assert result["account_id"] == "123456789012"
        assert result["instance_id"] == "12345678-1234-1234-1234-123456789012"


class TestValidateArnFormat:
    """Test validate_arn_format function."""

    def test_validate_arn_format_valid_s3(self):
        """Test validate_arn_format with valid S3 ARN."""
        arn = "arn:aws:s3:::my-bucket"
        result = validate_arn_format(arn, "s3")
        assert result is True

    def test_validate_arn_format_valid_lambda(self):
        """Test validate_arn_format with valid Lambda ARN."""
        arn = "arn:aws:lambda:us-west-2:123456789012:function:my-function"
        result = validate_arn_format(arn, "lambda")
        assert result is True

    def test_validate_arn_format_invalid(self):
        """Test validate_arn_format with invalid ARN."""
        arn = "invalid-arn-format"
        result = validate_arn_format(arn, "s3")
        assert result is False

    def test_validate_arn_format_wrong_service(self):
        """Test validate_arn_format with wrong service."""
        arn = "arn:aws:s3:::my-bucket"
        result = validate_arn_format(arn, "lambda")
        assert result is False


class TestExtractRegionFromArn:
    """Test extract_region_from_arn function."""

    def test_extract_region_from_arn_valid(self):
        """Test extracting region from valid ARN."""
        arn = "arn:aws:lambda:us-west-2:123456789012:function:my-function"
        result = extract_region_from_arn(arn)
        assert result == "us-west-2"

    def test_extract_region_from_arn_no_region(self):
        """Test extracting region from ARN without region."""
        arn = "arn:aws:s3:::my-bucket"
        result = extract_region_from_arn(arn)
        assert result is None

    def test_extract_region_from_arn_invalid(self):
        """Test extracting region from invalid ARN."""
        arn = "invalid-arn"
        result = extract_region_from_arn(arn)
        assert result is None

    def test_extract_region_from_arn_govcloud(self):
        """Test extracting region from GovCloud ARN."""
        arn = "arn:aws-us-gov:lambda:us-gov-west-1:123456789012:function:my-function"
        result = extract_region_from_arn(arn)
        assert result == "us-gov-west-1"


class TestExtractAccountIdFromArn:
    """Test extract_account_id_from_arn function."""

    def test_extract_account_id_from_arn_valid(self):
        """Test extracting account ID from valid ARN."""
        arn = "arn:aws:lambda:us-west-2:123456789012:function:my-function"
        result = extract_account_id_from_arn(arn)
        assert result == "123456789012"

    def test_extract_account_id_from_arn_no_account(self):
        """Test extracting account ID from ARN without account."""
        arn = "arn:aws:s3:::my-bucket"
        result = extract_account_id_from_arn(arn)
        assert result is None

    def test_extract_account_id_from_arn_invalid(self):
        """Test extracting account ID from invalid ARN."""
        arn = "invalid-arn"
        result = extract_account_id_from_arn(arn)
        assert result is None

    def test_extract_account_id_from_arn_china(self):
        """Test extracting account ID from China ARN."""
        arn = "arn:aws-cn:lambda:cn-north-1:123456789012:function:my-function"
        result = extract_account_id_from_arn(arn)
        assert result == "123456789012"
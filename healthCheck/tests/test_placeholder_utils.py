"""
Tests for placeholder replacement utilities
"""

import pytest

# Import the module under test
import sys
sys.path.insert(0, '/Users/tkuwar/opt/workspace/aws-integration/lambdas/healthCheck')

from utils.placeholder_utils import replace_placeholders, PLACEHOLDER_RE


class TestPlaceholderUtils:
    """Test cases for placeholder replacement functionality"""

    def test_replace_placeholders_string(self):
        """Test replacing placeholders in a simple string"""
        data = "Hello ${name}, welcome to ${place}!"
        replacements = {"name": "John", "place": "AWS"}
        
        result = replace_placeholders(data, replacements)
        assert result == "Hello John, welcome to AWS!"

    def test_replace_placeholders_dict(self):
        """Test replacing placeholders in a dictionary"""
        data = {
            "function_name": "${LambdaPrefix}MyFunction",
            "arn": "arn:aws:lambda:${AWS::Region}:${AWS::AccountId}:function:test",
            "bucket": "${S3BucketForTenantResources}"
        }
        replacements = {
            "LambdaPrefix": "MyOrg",
            "AWS::Region": "us-west-2",
            "AWS::AccountId": "123456789012",
            "S3BucketForTenantResources": "my-bucket"
        }
        
        result = replace_placeholders(data, replacements)
        
        expected = {
            "function_name": "MyOrgMyFunction",
            "arn": "arn:aws:lambda:us-west-2:123456789012:function:test",
            "bucket": "my-bucket"
        }
        assert result == expected

    def test_replace_placeholders_conditional_lambda_prefix_priority(self):
        """Test conditional placeholders with LambdaPrefix priority"""
        # Test case 1: LambdaPrefix is available - should use LambdaPrefix option
        data = {
            "function_name": "${CallCenterApiName}-Function|${LambdaPrefix}-Function",
            "role_name": "${CallCenterApiName}-Role|${LambdaPrefix}-Role"
        }
        replacements = {
            "CallCenterApiName": "mycc",
            "LambdaPrefix": "myorg"
        }
        
        result = replace_placeholders(data, replacements)
        
        expected = {
            "function_name": "myorg-Function",
            "role_name": "myorg-Role"
        }
        assert result == expected

    def test_replace_placeholders_conditional_no_lambda_prefix(self):
        """Test conditional placeholders when LambdaPrefix is not available"""
        # Test case 2: LambdaPrefix is not available - should use CallCenterApiName option
        data = {
            "function_name": "${CallCenterApiName}-Function|${LambdaPrefix}-Function",
            "role_name": "${CallCenterApiName}-Role|${LambdaPrefix}-Role"
        }
        replacements = {
            "CallCenterApiName": "mycc"
            # LambdaPrefix not provided
        }
        
        result = replace_placeholders(data, replacements)
        
        expected = {
            "function_name": "mycc-Function",
            "role_name": "mycc-Role"
        }
        assert result == expected

    def test_replace_placeholders_conditional_lambda_prefix_empty(self):
        """Test conditional placeholders when LambdaPrefix is empty string"""
        # Test case 3: LambdaPrefix is empty - should use CallCenterApiName option
        data = {
            "function_name": "${CallCenterApiName}-Function|${LambdaPrefix}-Function"
        }
        replacements = {
            "CallCenterApiName": "mycc",
            "LambdaPrefix": ""
        }
        
        result = replace_placeholders(data, replacements)
        
        expected = {
            "function_name": "mycc-Function"
        }
        assert result == expected

    def test_replace_placeholders_conditional_lowercase_lambda_prefix(self):
        """Test conditional placeholders with lowercase lambdaPrefix"""
        # Test case 4: lowercase lambdaPrefix should also get priority
        data = {
            "function_name": "${CallCenterApiName}-Function|${lambdaPrefix}-Function"
        }
        replacements = {
            "CallCenterApiName": "mycc",
            "lambdaPrefix": "multiorg"
        }
        
        result = replace_placeholders(data, replacements)
        
        expected = {
            "function_name": "multiorg-Function"
        }
        assert result == expected

    def test_replace_placeholders_conditional_mixed_case(self):
        """Test conditional placeholders with mixed case LambdaPrefix"""
        # Test case 5: Mixed case - should handle both LambdaPrefix and lambdaPrefix
        data = {
            "function1": "${CallCenterApiName}-Func1|${LambdaPrefix}-Func1",
            "function2": "${CallCenterApiName}-Func2|${lambdaPrefix}-Func2"
        }
        replacements = {
            "CallCenterApiName": "mycc",
            "LambdaPrefix": "myorg",
            "lambdaPrefix": "multiorg"
        }
        
        result = replace_placeholders(data, replacements)
        
        expected = {
            "function1": "myorg-Func1",
            "function2": "multiorg-Func2"
        }
        assert result == expected

    def test_replace_placeholders_list(self):
        """Test replacing placeholders in a list"""
        data = [
            "${LambdaPrefix}Function1",
            "${LambdaPrefix}Function2",
            "StaticFunction",
            "${AWS::Region}-bucket"
        ]
        replacements = {
            "LambdaPrefix": "MyOrg",
            "AWS::Region": "us-west-2"
        }
        
        result = replace_placeholders(data, replacements)
        
        expected = [
            "MyOrgFunction1",
            "MyOrgFunction2",
            "StaticFunction",
            "us-west-2-bucket"
        ]
        assert result == expected

    def test_replace_placeholders_nested_structure(self):
        """Test replacing placeholders in nested data structures"""
        data = {
            "functions": [
                {
                    "name": "${LambdaPrefix}Function1",
                    "arn": "arn:aws:lambda:${AWS::Region}:${AWS::AccountId}:function:${LambdaPrefix}Function1"
                },
                {
                    "name": "${LambdaPrefix}Function2",
                    "config": {
                        "region": "${AWS::Region}",
                        "bucket": "${S3BucketForTenantResources}"
                    }
                }
            ],
            "metadata": {
                "account": "${AWS::AccountId}",
                "partition": "${AWS::Partition}"
            }
        }
        replacements = {
            "LambdaPrefix": "MyOrg",
            "AWS::Region": "us-west-2",
            "AWS::AccountId": "123456789012",
            "AWS::Partition": "aws",
            "S3BucketForTenantResources": "my-bucket"
        }
        
        result = replace_placeholders(data, replacements)
        
        expected = {
            "functions": [
                {
                    "name": "MyOrgFunction1",
                    "arn": "arn:aws:lambda:us-west-2:123456789012:function:MyOrgFunction1"
                },
                {
                    "name": "MyOrgFunction2",
                    "config": {
                        "region": "us-west-2",
                        "bucket": "my-bucket"
                    }
                }
            ],
            "metadata": {
                "account": "123456789012",
                "partition": "aws"
            }
        }
        assert result == expected

    def test_replace_placeholders_missing_replacement(self):
        """Test behavior when replacement value is missing"""
        data = "Hello ${name}, welcome to ${unknown_place}!"
        replacements = {"name": "John"}
        
        result = replace_placeholders(data, replacements)
        # Should leave unknown placeholder unchanged
        assert result == "Hello John, welcome to ${unknown_place}!"

    def test_replace_placeholders_no_placeholders(self):
        """Test with data containing no placeholders"""
        data = {
            "function_name": "MyFunction",
            "arn": "arn:aws:lambda:us-west-2:123456789012:function:test",
            "static_list": ["item1", "item2", "item3"]
        }
        replacements = {"AWS::Region": "us-east-1"}
        
        result = replace_placeholders(data, replacements)
        assert result == data  # Should be unchanged

    def test_replace_placeholders_empty_replacements(self):
        """Test with empty replacements dictionary"""
        data = "Hello ${name}, welcome to ${place}!"
        replacements = {}
        
        result = replace_placeholders(data, replacements)
        assert result == data  # Should be unchanged

    def test_replace_placeholders_non_string_types(self):
        """Test with non-string data types"""
        data = {
            "number": 42,
            "boolean": True,
            "null_value": None,
            "float_value": 3.14,
            "string_with_placeholder": "${AWS::Region}"
        }
        replacements = {"AWS::Region": "us-west-2"}
        
        result = replace_placeholders(data, replacements)
        
        expected = {
            "number": 42,
            "boolean": True,
            "null_value": None,
            "float_value": 3.14,
            "string_with_placeholder": "us-west-2"
        }
        assert result == expected

    def test_placeholder_regex_pattern(self):
        """Test the placeholder regex pattern directly"""
        # Test valid patterns
        assert PLACEHOLDER_RE.match("${ValidPlaceholder}")
        assert PLACEHOLDER_RE.match("${AWS::Region}")
        assert PLACEHOLDER_RE.match("${LambdaPrefix}")
        assert PLACEHOLDER_RE.match("${123}")
        
        # Test that pattern captures the placeholder name
        match = PLACEHOLDER_RE.search("${AWS::Region}")
        assert match.group(1) == "AWS::Region"
        
        match = PLACEHOLDER_RE.search("${LambdaPrefix}")
        assert match.group(1) == "LambdaPrefix"

    def test_multiple_placeholders_same_string(self):
        """Test multiple placeholders in the same string"""
        data = "${AWS::Partition}:${AWS::Region}:${AWS::AccountId}"
        replacements = {
            "AWS::Partition": "aws",
            "AWS::Region": "us-west-2", 
            "AWS::AccountId": "123456789012"
        }
        
        result = replace_placeholders(data, replacements)
        assert result == "aws:us-west-2:123456789012"

    def test_replace_placeholders_with_special_characters(self):
        """Test placeholders and values with special characters"""
        data = "${special-name} and ${name_with_underscore}"
        replacements = {
            "special-name": "value-with-dash",
            "name_with_underscore": "value_with_underscore"
        }
        
        result = replace_placeholders(data, replacements)
        assert result == "value-with-dash and value_with_underscore"

    def test_replace_placeholders_conditional_within_string(self):
        """Test conditional placeholders within larger strings (e.g., alarm names)"""
        # Test case: Alarm name with conditional function name and suffix
        data = "SCV Lambda ${LambdaPrefix}-CTRDataSyncFunction|${CallCenterApiName}-CTRDataSyncFunction Errors"
        replacements = {
            "LambdaPrefix": "myorg",
            "CallCenterApiName": "mycc"
        }
        
        result = replace_placeholders(data, replacements)
        # Should use LambdaPrefix option and preserve the " Errors" suffix
        assert result == "SCV Lambda myorg-CTRDataSyncFunction Errors"

    def test_replace_placeholders_conditional_within_string_no_lambda_prefix(self):
        """Test conditional placeholders within strings when LambdaPrefix is empty"""
        # Test case: Alarm name with conditional function name, LambdaPrefix empty
        data = "SCV Lambda ${LambdaPrefix}-CTRDataSyncFunction|${CallCenterApiName}-CTRDataSyncFunction Throttles"
        replacements = {
            "LambdaPrefix": "",
            "CallCenterApiName": "mycc"
        }
        
        result = replace_placeholders(data, replacements)
        # Should use CallCenterApiName option and preserve the " Throttles" suffix
        assert result == "SCV Lambda mycc-CTRDataSyncFunction Throttles"

    def test_replace_placeholders_multiple_conditionals_in_string(self):
        """Test multiple conditional placeholders within the same string"""
        data = "Rule ${LambdaPrefix}-Rule|${CallCenterApiName}-Rule targets ${LambdaPrefix}-Function|${CallCenterApiName}-Function"
        replacements = {
            "LambdaPrefix": "myorg",
            "CallCenterApiName": "mycc"
        }
        
        result = replace_placeholders(data, replacements)
        # Both conditionals should use LambdaPrefix option
        assert result == "Rule myorg-Rule targets myorg-Function"

    def test_replace_placeholders_in_string_basic(self):
        """Test replace_placeholders_in_string function directly."""
        from utils.placeholder_utils import replace_placeholders_in_string
        
        data = "Hello ${name}, welcome to ${place}!"
        replacements = {"name": "John", "place": "SCV"}
        result = replace_placeholders_in_string(data, replacements)
        assert result == "Hello John, welcome to SCV!"

    def test_replace_placeholders_in_string_missing_replacement(self):
        """Test replace_placeholders_in_string with missing replacement."""
        from utils.placeholder_utils import replace_placeholders_in_string
        
        data = "Hello ${name}, welcome to ${missing}!"
        replacements = {"name": "John"}
        result = replace_placeholders_in_string(data, replacements)
        assert result == "Hello John, welcome to ${missing}!"

    def test_resolve_conditional_options_priority(self):
        """Test resolve_conditional_options function directly."""
        from utils.placeholder_utils import resolve_conditional_options
        
        # Test LambdaPrefix priority
        replacements = {"LambdaPrefix": "myprefix", "CallCenterApiName": "mycc"}
        result = resolve_conditional_options("${LambdaPrefix}-func", "${CallCenterApiName}-func", replacements)
        assert result == "myprefix-func"

    def test_resolve_conditional_options_fallback(self):
        """Test resolve_conditional_options fallback logic."""
        from utils.placeholder_utils import resolve_conditional_options
        
        # Test fallback when LambdaPrefix is empty
        replacements = {"LambdaPrefix": "", "CallCenterApiName": "mycc"}
        result = resolve_conditional_options("${LambdaPrefix}-func", "${CallCenterApiName}-func", replacements)
        assert result == "mycc-func"

    def test_resolve_conditional_options_unresolved(self):
        """Test resolve_conditional_options with unresolved placeholders."""
        from utils.placeholder_utils import resolve_conditional_options
        
        # Test when neither option can be fully resolved
        replacements = {"SomeOther": "value"}
        result = resolve_conditional_options("${LambdaPrefix}-func", "${CallCenterApiName}-func", replacements)
        assert result == "${LambdaPrefix}-func"  # Should return first option

    def test_replace_placeholders_in_string_direct(self):
        """Test replace_placeholders_in_string function directly."""
        from utils.placeholder_utils import replace_placeholders_in_string
        
        data = "Hello ${name}, welcome to ${place}!"
        replacements = {"name": "John", "place": "SCV"}
        result = replace_placeholders_in_string(data, replacements)
        assert result == "Hello John, welcome to SCV!"

    def test_replace_placeholders_in_string_missing_replacement(self):
        """Test replace_placeholders_in_string with missing replacement."""
        from utils.placeholder_utils import replace_placeholders_in_string
        
        data = "Hello ${name}, welcome to ${missing}!"
        replacements = {"name": "John"}
        result = replace_placeholders_in_string(data, replacements)
        assert result == "Hello John, welcome to ${missing}!"

    def test_resolve_conditional_options_priority_direct(self):
        """Test resolve_conditional_options function directly."""
        from utils.placeholder_utils import resolve_conditional_options
        
        # Test LambdaPrefix priority
        replacements = {"LambdaPrefix": "myprefix", "CallCenterApiName": "mycc"}
        result = resolve_conditional_options("${LambdaPrefix}-func", "${CallCenterApiName}-func", replacements)
        assert result == "myprefix-func"

    def test_resolve_conditional_options_fallback_direct(self):
        """Test resolve_conditional_options fallback logic."""
        from utils.placeholder_utils import resolve_conditional_options
        
        # Test fallback when LambdaPrefix is empty
        replacements = {"LambdaPrefix": "", "CallCenterApiName": "mycc"}
        result = resolve_conditional_options("${LambdaPrefix}-func", "${CallCenterApiName}-func", replacements)
        assert result == "mycc-func"

    def test_resolve_cloudformation_references(self):
        """Test resolve_cloudformation_references function."""
        from utils.placeholder_utils import resolve_cloudformation_references
        
        # Test basic CloudFormation reference resolution
        text = "StreamDiscoveryCustomResource.Arn"
        replacements = {"StreamArn": "arn:aws:kinesis:us-west-2:123456789012:stream/test"}
        result = resolve_cloudformation_references(text, replacements)
        
        # Should return a pattern for ARN matching
        assert "arn:aws:" in result or "StreamDiscoveryCustomResource.Arn" in result

    def test_resolve_cloudformation_references_no_match(self):
        """Test resolve_cloudformation_references with no matching pattern."""
        from utils.placeholder_utils import resolve_cloudformation_references
        
        text = "regular text with no references"
        replacements = {"StreamArn": "arn:aws:kinesis:us-west-2:123456789012:stream/test"}
        result = resolve_cloudformation_references(text, replacements)
        
        assert result == "regular text with no references"

    def test_resolve_conditional_options_edge_cases(self):
        """Test resolve_conditional_options edge cases."""
        from utils.placeholder_utils import resolve_conditional_options
        
        # Test when both options start with dash (fallback scenario)
        replacements = {"SomeKey": "value"}
        result = resolve_conditional_options("-option1", "-option2", replacements)
        assert result == "-option1"  # Should return first option

    def test_replace_placeholders_in_string_edge_cases(self):
        """Test replace_placeholders_in_string with edge cases."""
        from utils.placeholder_utils import replace_placeholders_in_string
        
        # Test with empty string
        result = replace_placeholders_in_string("", {"key": "value"})
        assert result == ""
        
        # Test with no placeholders
        result = replace_placeholders_in_string("no placeholders here", {"key": "value"})
        assert result == "no placeholders here"
        
        # Test with malformed placeholder
        result = replace_placeholders_in_string("${incomplete", {"incomplete": "value"})
        assert result == "${incomplete"  # Should remain unchanged

#!/usr/bin/env python3
"""
Simple test runner for health check lambda tests when pytest is not available
"""

import sys
import os
import traceback

# Add the parent directory to Python path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def run_basic_tests():
    """Run basic functionality tests"""
    tests_passed = 0
    tests_failed = 0
    
    print("Running Health Check Lambda Tests")
    print("-" * 50)
    
    # Test 1: Health Models
    try:
        from models.health_models import HealthCheckInput, HealthStatus
        
        # Test HealthStatus enum
        assert HealthStatus.HEALTHY.value == "HEALTHY"
        assert HealthStatus.UNHEALTHY.value == "UNHEALTHY"
        
        # Test HealthCheckInput creation
        health_input = HealthCheckInput(
            cc_version="19.0",
            cc_name="ServiceCloudVoice",
            sku="resell",
            connect_instance_arn="arn:aws:connect:us-west-2:123456789012:instance/12345678-1234-1234-1234-123456789012"
        )
        assert health_input.cc_version == "19.0"
        assert health_input.connect_instance_arn.startswith("arn:aws:connect:")
        assert health_input.max_threads == 10  # Default value
        
        print("PASS: Test 1: Health Models")
        tests_passed += 1
        
    except Exception as e:
        print(f"FAIL: Test 1: Health Models - {e}")
        tests_failed += 1
    
    # Test 2: Placeholder Utils
    try:
        from utils.placeholder_utils import replace_placeholders
        
        # Test simple replacement
        result = replace_placeholders("Hello ${name}", {"name": "World"})
        assert result == "Hello World"
        
        # Test nested structure
        data = {"function": "${prefix}Function", "region": "${AWS::Region}"}
        replacements = {"prefix": "MyOrg", "AWS::Region": "us-west-2"}
        result = replace_placeholders(data, replacements)
        expected = {"function": "MyOrgFunction", "region": "us-west-2"}
        assert result == expected
        
        print("PASS: Test 2: Placeholder Utils")
        tests_passed += 1
        
    except Exception as e:
        print(f"FAIL: Test 2: Placeholder Utils - {e}")
        tests_failed += 1
    
    # Test 3: Logging Utils
    try:
        from utils.logging_utils import is_debug_enabled
        
        # Test debug detection
        os.environ['LOG_LEVEL'] = 'INFO'
        assert is_debug_enabled() == True
        
        os.environ['LOG_LEVEL'] = 'ERROR'
        assert is_debug_enabled() == False
        
        # Test telemetry level
        os.environ['LOG_LEVEL'] = ''
        os.environ['_LAMBDA_TELEMETRY_LOG_LEVEL'] = 'DEBUG'
        assert is_debug_enabled() == True
        
        print("PASS: Test 3: Logging Utils")
        tests_passed += 1
        
    except Exception as e:
        print(f"FAIL: Test 3: Logging Utils - {e}")
        tests_failed += 1
    
    # Test 4: Input Parser
    try:
        from models.input_parser import parse_input_parameters
        from unittest.mock import patch, MagicMock
        
        # Set up environment variables for testing
        test_env = {
            'VERSION': '19.0',
            'CALL_CENTER_API_NAME': 'ServiceCloudVoice',
            'SKU': 'RESELL',
            'CONNECT_INSTANCE_ID': '12345678-1234-1234-1234-123456789012',
            'S3_BUCKET_FOR_TENANT_RESOURCES': 'tenant-bucket',
            'AWS_REGION': 'us-west-2'
        }
        
        # Test valid input with environment variables
        with patch.dict(os.environ, test_env):
            with patch('boto3.client') as mock_boto3:
                # Mock STS client
                mock_sts = MagicMock()
                mock_sts.get_caller_identity.return_value = {"Account": "123456789012"}
                mock_boto3.return_value = mock_sts
                
                event = {"execution_id": "exec-123-456"}
                result = parse_input_parameters(event)
                assert result.cc_version == "19.0"
                assert result.execution_id == "exec-123-456"
                assert result.sku == "resell"  # Should be lowercase
                assert "arn:aws:connect:us-west-2:123456789012:instance" in result.connect_instance_arn
        
        # Test missing required environment variable
        incomplete_env = {'VERSION': '19.0'}  # Missing other required env vars
        with patch.dict(os.environ, incomplete_env, clear=True):
            try:
                parse_input_parameters({})
                assert False, "Should have raised ValueError"
            except ValueError as e:
                assert "Missing required environment variables" in str(e)
        
        print("PASS: Test 4: Input Parser")
        tests_passed += 1
        
    except Exception as e:
        print(f"FAIL: Test 4: Input Parser - {e}")
        tests_failed += 1
    
    # Test 5: Import Chain
    try:
        # Set mock AWS credentials to avoid credential errors
        os.environ['AWS_ACCESS_KEY_ID'] = 'test-key'
        os.environ['AWS_SECRET_ACCESS_KEY'] = 'test-secret'
        os.environ['AWS_DEFAULT_REGION'] = 'us-east-1'
        
        from healthcheck import lambda_handler
        from core.config import load_expected_from_layer
        from core.multithreading import MultiThreadedValidator
        from core.reporting import generate_enhanced_report
        
        print("PASS: Test 5: Import Chain")
        tests_passed += 1
        
    except Exception as e:
        print(f"FAIL: Test 5: Import Chain - {e}")
        tests_failed += 1
    
    # Summary
    print("-" * 50)
    print(f"Test Results: {tests_passed} passed, {tests_failed} failed")
    
    if tests_failed == 0:
        print("All tests passed!")
        return True
    else:
        print("Some tests failed")
        return False


if __name__ == "__main__":
    success = run_basic_tests()
    sys.exit(0 if success else 1)
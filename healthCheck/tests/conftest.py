"""
Pytest configuration and fixtures for health check lambda tests
"""

import pytest
import sys
import os

# Add the healthCheck directory to Python path for imports
sys.path.insert(0, '/Users/tkuwar/opt/workspace/aws-integration/lambdas/healthCheck')


@pytest.fixture
def sample_health_input():
    """Fixture providing a sample HealthCheckInput for testing"""
    from models.health_models import HealthCheckInput
    
    return HealthCheckInput(
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
        include_detailed_errors=True,
        max_threads=10
    )


@pytest.fixture
def sample_lambda_event():
    """Fixture providing a sample Lambda event for testing (minimal since config comes from env vars)"""
    return {
        "execution_id": "exec-123-456",
        "max_threads": 10,
        "include_detailed_errors": True
    }


@pytest.fixture
def sample_environment_variables():
    """Fixture providing sample environment variables for testing"""
    return {
        'VERSION': '19.0',
        'CALL_CENTER_API_NAME': 'ServiceCloudVoice',
        'SKU': 'RESELL',
        'CONNECT_INSTANCE_ID': '12345678-1234-1234-1234-123456789012',
        'S3_BUCKET_FOR_TENANT_RESOURCES': 'tenant-resources-bucket',
        'AWS_REGION': 'us-west-2',
        'LOG_LEVEL': 'INFO'
    }


@pytest.fixture
def sample_config():
    """Fixture providing sample configuration data"""
    return {
        "LambdaFunctions": [
            {
                "name": "${LambdaPrefix}Function1",
                "alias": "active",
                "layers": ["${LambdaPrefix}Layer1"],
                "execution_role": "${LambdaPrefix}Role1"
            },
            {
                "name": "${LambdaPrefix}Function2",
                "alias": "active",
                "layers": [],
                "execution_role": "${LambdaPrefix}Role2"
            }
        ],
        "IAMRoles": [
            {
                "name": "${LambdaPrefix}Role1",
                "simulate_actions": [
                    "s3:GetObject",
                    "lambda:InvokeFunction"
                ]
            }
        ],
        "S3Buckets": [
            {
                "name": "${S3BucketForTenantResources}",
                "policy": True
            }
        ],
        "CloudWatchAlarms": [
            {
                "name": "${LambdaPrefix}Function1-Errors"
            }
        ]
    }


@pytest.fixture
def sample_placeholder_map():
    """Fixture providing sample placeholder replacements"""
    return {
        "AWS::Region": "us-west-2",
        "AWS::AccountId": "123456789012",
        "AWS::Partition": "aws",
        "ConnectInstanceId": "12345678-1234-1234-1234-123456789012",
        "CallCenterApiName": "ServiceCloudVoice",
        "S3BucketForTenantResources": "tenant-resources-bucket",
        "LambdaPrefix": "MyOrg",
        "lambdaPrefix": "MyOrg"
    }


@pytest.fixture
def sample_validation_results():
    """Fixture providing sample validation results"""
    return [
        {
            "ResourceType": "Lambda Function",
            "DetailedHealthCheck": [
                {
                    "ResourceName": "MyOrgFunction1",
                    "status": 200,
                    "message": "healthy"
                },
                {
                    "ResourceName": "MyOrgFunction2", 
                    "status": 500,
                    "message": "Function not found"
                }
            ]
        },
        {
            "ResourceType": "IAM Role",
            "DetailedHealthCheck": [
                {
                    "ResourceName": "MyOrgRole1",
                    "status": 200,
                    "message": "healthy"
                }
            ]
        }
    ]


@pytest.fixture(autouse=True)
def reset_environment():
    """Fixture to reset environment variables after each test"""
    # Store original environment
    original_env = dict(os.environ)
    
    yield
    
    # Restore original environment
    os.environ.clear()
    os.environ.update(original_env)


@pytest.fixture
def mock_aws_clients():
    """Fixture providing mock AWS clients"""
    from unittest.mock import MagicMock
    
    clients = {
        'sts': MagicMock(),
        'iam': MagicMock(),
        'lambda': MagicMock(),
        's3': MagicMock(),
        'cloudwatch': MagicMock(),
        'events': MagicMock(),
        'kinesis': MagicMock(),
        'kms': MagicMock(),
        'cloudformation': MagicMock()
    }
    
    # Set up default successful responses
    clients['sts'].get_caller_identity.return_value = {
        "Account": "123456789012",
        "Arn": "arn:aws:sts::123456789012:assumed-role/test-role/test-session"
    }
    
    return clients

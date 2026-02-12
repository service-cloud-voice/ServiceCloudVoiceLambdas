"""
Tests for utils/aws_helpers.py

Specifically tests the simulate_actions function wildcard handling (lines 196-217).
"""

import pytest
from unittest.mock import patch, MagicMock
from botocore.exceptions import ClientError

# Import the module under test
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from utils.aws_helpers import simulate_actions


class TestSimulateActionsWildcardHandling:
    """Test cases for simulate_actions wildcard resource and action handling (lines 196-217)"""

    def test_resource_arn_exactly_wildcard(self):
        """
        Test when resource_arn is exactly "*".
        This should set has_problematic_wildcard=True and skip simulation.
        Covers line 196.
        """
        mock_iam = MagicMock()
        role = "TestRole"
        actions = ["s3:GetObject"]
        account_id = "123456789012"
        resource_arn = "*"
        
        # Execute
        results = simulate_actions(role, actions, mock_iam, account_id, resource_arn)
        
        # Verify simulation was skipped (has_problematic_wildcard=True)
        assert len(results) == 1
        assert results[0][0] is True  # Success (skipped)
        assert "Skipped action 's3:GetObject' on wildcard resource '*'" in results[0][1]
        assert "may cause implicit deny" in results[0][1]
        
        # Verify IAM client was NOT called
        mock_iam.simulate_principal_policy.assert_not_called()

    def test_resource_arn_with_wildcard_in_resource_portion(self):
        """
        Test when resource_arn has wildcard in the resource portion (index 5+).
        Example: "arn:aws:s3:::my-bucket/*"
        This should set has_problematic_wildcard=True.
        Covers lines 197-203.
        """
        mock_iam = MagicMock()
        role = "TestRole"
        actions = ["s3:GetObject"]
        account_id = "123456789012"
        resource_arn = "arn:aws:s3:::my-bucket/*"
        
        # Execute
        results = simulate_actions(role, actions, mock_iam, account_id, resource_arn)
        
        # Verify simulation was skipped
        assert len(results) == 1
        assert results[0][0] is True
        assert "Skipped action 's3:GetObject' on wildcard resource" in results[0][1]
        assert "my-bucket/*" in results[0][1]
        
        # Verify IAM client was NOT called
        mock_iam.simulate_principal_policy.assert_not_called()

    def test_resource_arn_with_wildcard_not_in_resource_portion(self):
        """
        Test when resource_arn has wildcard but NOT in the resource portion.
        Example: "arn:aws:s3:*:123456789012:bucket/key" (wildcard in region)
        This should set has_problematic_wildcard=False and proceed with simulation.
        Covers lines 197-203.
        """
        mock_iam = MagicMock()
        role = "TestRole"
        actions = ["s3:GetObject"]
        account_id = "123456789012"
        # Wildcard in region portion (index 3), not in resource portion (index 5+)
        resource_arn = "arn:aws:s3:*:123456789012:bucket/key"
        
        # Mock successful IAM simulation
        mock_iam.simulate_principal_policy.return_value = {
            "EvaluationResults": [{
                "EvalDecision": "allowed"
            }]
        }
        
        # Execute
        results = simulate_actions(role, actions, mock_iam, account_id, resource_arn)
        
        # Verify simulation was NOT skipped (has_problematic_wildcard=False)
        assert len(results) == 1
        assert results[0][0] is True
        assert "ALLOWS 's3:GetObject'" in results[0][1]
        
        # Verify IAM client WAS called (simulation ran)
        mock_iam.simulate_principal_policy.assert_called_once()

    def test_resource_arn_with_unexpected_format(self):
        """
        Test when resource_arn has wildcard but ARN format is unexpected (< 6 parts).
        This should set has_problematic_wildcard=True (conservative approach).
        Covers lines 204-206.
        """
        mock_iam = MagicMock()
        role = "TestRole"
        actions = ["s3:GetObject"]
        account_id = "123456789012"
        # Malformed ARN with only 4 parts (less than 6)
        resource_arn = "arn:aws:s3:*"
        
        # Execute
        results = simulate_actions(role, actions, mock_iam, account_id, resource_arn)
        
        # Verify simulation was skipped (conservative approach for unexpected format)
        assert len(results) == 1
        assert results[0][0] is True
        assert "Skipped action" in results[0][1]
        assert "wildcard resource" in results[0][1]
        
        # Verify IAM client was NOT called
        mock_iam.simulate_principal_policy.assert_not_called()

    def test_action_with_wildcard(self):
        """
        Test when action contains wildcard (e.g., "s3:*").
        Wildcard actions should be skipped.
        Covers lines 208-212.
        """
        mock_iam = MagicMock()
        role = "TestRole"
        actions = ["s3:*"]
        account_id = "123456789012"
        resource_arn = "arn:aws:s3:::my-bucket/key"
        
        # Execute
        results = simulate_actions(role, actions, mock_iam, account_id, resource_arn)
        
        # Verify wildcard action was skipped
        assert len(results) == 1
        assert results[0][0] is True
        assert "Skipped wildcard action 's3:*'" in results[0][1]
        assert "not supported by IAM simulation" in results[0][1]
        
        # Verify IAM client was NOT called
        mock_iam.simulate_principal_policy.assert_not_called()

    def test_multiple_actions_with_wildcards(self):
        """
        Test multiple actions where some have wildcards and some don't.
        Covers lines 208-212.
        """
        mock_iam = MagicMock()
        role = "TestRole"
        actions = ["s3:*", "s3:GetObject", "lambda:*"]
        account_id = "123456789012"
        resource_arn = "arn:aws:s3:::my-bucket/key"
        
        # Mock successful IAM simulation for non-wildcard action
        mock_iam.simulate_principal_policy.return_value = {
            "EvaluationResults": [{
                "EvalDecision": "allowed"
            }]
        }
        
        # Execute
        results = simulate_actions(role, actions, mock_iam, account_id, resource_arn)
        
        # Verify 3 results (2 skipped, 1 simulated)
        assert len(results) == 3
        
        # First action (s3:*) - skipped
        assert results[0][0] is True
        assert "Skipped wildcard action 's3:*'" in results[0][1]
        
        # Second action (s3:GetObject) - simulated
        assert results[1][0] is True
        assert "ALLOWS 's3:GetObject'" in results[1][1]
        
        # Third action (lambda:*) - skipped
        assert results[2][0] is True
        assert "Skipped wildcard action 'lambda:*'" in results[2][1]
        
        # Verify IAM client was called only once (for non-wildcard action)
        assert mock_iam.simulate_principal_policy.call_count == 1

    def test_wildcard_action_on_wildcard_resource(self):
        """
        Test combination of wildcard action and wildcard resource.
        Wildcard action should be checked first and skipped before resource check.
        Covers lines 208-212 (action check happens before resource check).
        """
        mock_iam = MagicMock()
        role = "TestRole"
        actions = ["s3:*"]
        account_id = "123456789012"
        resource_arn = "*"
        
        # Execute
        results = simulate_actions(role, actions, mock_iam, account_id, resource_arn)
        
        # Verify wildcard action was skipped (not wildcard resource message)
        assert len(results) == 1
        assert results[0][0] is True
        assert "Skipped wildcard action" in results[0][1]
        assert "not supported by IAM simulation" in results[0][1]
        
        # Verify IAM client was NOT called
        mock_iam.simulate_principal_policy.assert_not_called()

    def test_non_wildcard_action_on_wildcard_resource(self):
        """
        Test non-wildcard action on wildcard resource.
        Should skip due to wildcard resource.
        Covers lines 214-217.
        """
        mock_iam = MagicMock()
        role = "TestRole"
        actions = ["s3:GetObject"]
        account_id = "123456789012"
        resource_arn = "*"
        
        # Execute
        results = simulate_actions(role, actions, mock_iam, account_id, resource_arn)
        
        # Verify simulation was skipped due to wildcard resource
        assert len(results) == 1
        assert results[0][0] is True
        assert "Skipped action 's3:GetObject' on wildcard resource '*'" in results[0][1]
        assert "may cause implicit deny" in results[0][1]
        
        # Verify IAM client was NOT called
        mock_iam.simulate_principal_policy.assert_not_called()

    def test_multiple_actions_on_wildcard_resource(self):
        """
        Test multiple non-wildcard actions on wildcard resource.
        All should be skipped due to wildcard resource.
        Covers lines 208-217 (loop with wildcard resource).
        """
        mock_iam = MagicMock()
        role = "TestRole"
        actions = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
        account_id = "123456789012"
        resource_arn = "arn:aws:s3:::my-bucket/*"
        
        # Execute
        results = simulate_actions(role, actions, mock_iam, account_id, resource_arn)
        
        # Verify all 3 actions were skipped
        assert len(results) == 3
        for i, action in enumerate(actions):
            assert results[i][0] is True
            assert f"Skipped action '{action}' on wildcard resource" in results[i][1]
        
        # Verify IAM client was NOT called
        mock_iam.simulate_principal_policy.assert_not_called()

    def test_resource_arn_with_multiple_wildcards_in_resource_portion(self):
        """
        Test resource_arn with multiple wildcards in resource portion.
        Example: "arn:aws:s3:::my-bucket/*/subfolder/*"
        Should detect wildcard and skip simulation.
        Covers lines 197-203.
        """
        mock_iam = MagicMock()
        role = "TestRole"
        actions = ["s3:GetObject"]
        account_id = "123456789012"
        resource_arn = "arn:aws:s3:::my-bucket/*/subfolder/*"
        
        # Execute
        results = simulate_actions(role, actions, mock_iam, account_id, resource_arn)
        
        # Verify simulation was skipped
        assert len(results) == 1
        assert results[0][0] is True
        assert "Skipped action" in results[0][1]
        assert "wildcard resource" in results[0][1]
        
        # Verify IAM client was NOT called
        mock_iam.simulate_principal_policy.assert_not_called()

    def test_resource_arn_without_wildcard(self):
        """
        Test normal resource_arn without any wildcards.
        Should proceed with simulation normally.
        Covers lines 196-206 (all checks pass, has_problematic_wildcard=False).
        """
        mock_iam = MagicMock()
        role = "TestRole"
        actions = ["s3:GetObject"]
        account_id = "123456789012"
        resource_arn = "arn:aws:s3:::my-bucket/my-key"
        
        # Mock successful IAM simulation
        mock_iam.simulate_principal_policy.return_value = {
            "EvaluationResults": [{
                "EvalDecision": "allowed"
            }]
        }
        
        # Execute
        results = simulate_actions(role, actions, mock_iam, account_id, resource_arn)
        
        # Verify simulation ran successfully
        assert len(results) == 1
        assert results[0][0] is True
        assert "ALLOWS 's3:GetObject'" in results[0][1]
        
        # Verify IAM client WAS called
        mock_iam.simulate_principal_policy.assert_called_once_with(
            PolicySourceArn=f"arn:aws:iam::{account_id}:role/{role}",
            ActionNames=["s3:GetObject"],
            ResourceArns=[resource_arn]
        )

    def test_mixed_scenario_wildcard_and_normal_actions(self):
        """
        Test complex scenario with:
        - Some wildcard actions (should be skipped)
        - Some normal actions on wildcard resource (should be skipped)
        - Mixture of both
        Covers lines 208-217 in various combinations.
        """
        mock_iam = MagicMock()
        role = "TestRole"
        actions = ["s3:*", "s3:GetObject", "lambda:InvokeFunction"]
        account_id = "123456789012"
        resource_arn = "*"
        
        # Execute
        results = simulate_actions(role, actions, mock_iam, account_id, resource_arn)
        
        # Verify all 3 actions were skipped for different reasons
        assert len(results) == 3
        
        # First action skipped due to wildcard action
        assert results[0][0] is True
        assert "Skipped wildcard action" in results[0][1]
        
        # Second and third actions skipped due to wildcard resource
        assert results[1][0] is True
        assert "Skipped action 's3:GetObject' on wildcard resource" in results[1][1]
        assert results[2][0] is True
        assert "Skipped action 'lambda:InvokeFunction' on wildcard resource" in results[2][1]
        
        # Verify IAM client was NOT called
        mock_iam.simulate_principal_policy.assert_not_called()

    def test_edge_case_empty_actions_list(self):
        """
        Test edge case with empty actions list.
        Should return empty results (no iterations of loop at line 208).
        """
        mock_iam = MagicMock()
        role = "TestRole"
        actions = []
        account_id = "123456789012"
        resource_arn = "*"
        
        # Execute
        results = simulate_actions(role, actions, mock_iam, account_id, resource_arn)
        
        # Verify empty results
        assert len(results) == 0
        
        # Verify IAM client was NOT called
        mock_iam.simulate_principal_policy.assert_not_called()

    def test_arn_with_colon_in_resource_portion(self):
        """
        Test ARN with colons in the resource portion (valid ARN format).
        Example: "arn:aws:dynamodb:us-east-1:123456789012:table/MyTable"
        Resource portion is "table/MyTable" (no wildcard).
        Should proceed with simulation.
        Covers lines 200-203 (resource_portion = ':'.join(arn_parts[5:])).
        """
        mock_iam = MagicMock()
        role = "TestRole"
        actions = ["dynamodb:GetItem"]
        account_id = "123456789012"
        resource_arn = "arn:aws:dynamodb:us-east-1:123456789012:table/MyTable"
        
        # Mock successful IAM simulation
        mock_iam.simulate_principal_policy.return_value = {
            "EvaluationResults": [{
                "EvalDecision": "allowed"
            }]
        }
        
        # Execute
        results = simulate_actions(role, actions, mock_iam, account_id, resource_arn)
        
        # Verify simulation ran successfully
        assert len(results) == 1
        assert results[0][0] is True
        assert "ALLOWS 'dynamodb:GetItem'" in results[0][1]
        
        # Verify IAM client WAS called
        mock_iam.simulate_principal_policy.assert_called_once()

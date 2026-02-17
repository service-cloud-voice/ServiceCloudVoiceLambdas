"""
Tests for utils/aws_helpers.py

Specifically tests the simulate_actions function wildcard handling.
Tests validate that:
1. Wildcard actions are verified against actual role policies
2. Wildcard resources are handled appropriately
3. Missing permissions are properly reported as failures
"""

import pytest
from unittest.mock import patch, MagicMock
from botocore.exceptions import ClientError

# Import the module under test
import sys
import os

from utils.aws_helpers import (
    simulate_actions, 
    _get_role_actual_actions, 
    _match_wildcard_action,
    _pattern_covers_pattern
)


class TestSimulateActionsWildcardHandling:
    """Test cases for simulate_actions wildcard resource and action handling"""

    def test_resource_arn_exactly_wildcard(self):
        """
        Test when resource_arn is exactly "*".
        IAM simulation is always called first for non-wildcard actions.
        """
        mock_iam = MagicMock()
        role = "TestRole"
        actions = ["s3:GetObject"]
        account_id = "123456789012"
        resource_arn = "*"
        
        # Mock successful IAM simulation
        mock_iam.simulate_principal_policy.return_value = {
            "EvaluationResults": [{"EvalDecision": "allowed"}]
        }
        
        # Execute
        results = simulate_actions(role, actions, mock_iam, account_id, resource_arn)
        
        # Verify simulation was called and action allowed
        assert len(results) == 1
        assert results[0][0] is True
        assert "ALLOWS 's3:GetObject'" in results[0][1]
        
        # Verify simulate_principal_policy WAS called (always use simulation first)
        mock_iam.simulate_principal_policy.assert_called_once()

    def test_resource_arn_with_wildcard_in_resource_portion(self):
        """
        Test when resource_arn has wildcard in the resource portion (index 5+).
        Example: "arn:aws:s3:::my-bucket/*"
        IAM simulation is always called first for non-wildcard actions.
        """
        mock_iam = MagicMock()
        role = "TestRole"
        actions = ["s3:GetObject"]
        account_id = "123456789012"
        resource_arn = "arn:aws:s3:::my-bucket/*"
        
        # Mock successful IAM simulation
        mock_iam.simulate_principal_policy.return_value = {
            "EvaluationResults": [{"EvalDecision": "allowed"}]
        }
        
        # Execute
        results = simulate_actions(role, actions, mock_iam, account_id, resource_arn)
        
        # Verify simulation was called and action allowed
        assert len(results) == 1
        assert results[0][0] is True
        assert "ALLOWS 's3:GetObject'" in results[0][1]
        
        # Verify simulate_principal_policy WAS called
        mock_iam.simulate_principal_policy.assert_called_once()

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
        IAM simulation is always called first for non-wildcard actions.
        """
        mock_iam = MagicMock()
        role = "TestRole"
        actions = ["s3:GetObject"]
        account_id = "123456789012"
        # Malformed ARN with only 4 parts (less than 6)
        resource_arn = "arn:aws:s3:*"
        
        # Mock successful IAM simulation
        mock_iam.simulate_principal_policy.return_value = {
            "EvaluationResults": [{"EvalDecision": "allowed"}]
        }
        
        # Execute
        results = simulate_actions(role, actions, mock_iam, account_id, resource_arn)
        
        # Verify simulation was called and action allowed
        assert len(results) == 1
        assert results[0][0] is True
        assert "ALLOWS 's3:GetObject'" in results[0][1]
        
        # Verify simulate_principal_policy WAS called
        mock_iam.simulate_principal_policy.assert_called_once()

    def test_action_with_wildcard_matching_permission(self):
        """
        Test when action contains wildcard (e.g., "s3:*") and role has the exact wildcard permission.
        Wildcard actions should be validated against actual role policies.
        Now requires exact wildcard in policy, not just specific matching actions.
        """
        mock_iam = MagicMock()
        role = "TestRole"
        actions = ["s3:*"]
        account_id = "123456789012"
        resource_arn = "arn:aws:s3:::my-bucket/key"
        
        # Mock role has s3:* permission (exact wildcard)
        mock_iam.list_attached_role_policies.return_value = {"AttachedPolicies": [{"PolicyArn": "arn:aws:iam::123456789012:policy/TestPolicy"}]}
        mock_iam.get_policy.return_value = {"Policy": {"DefaultVersionId": "v1"}}
        mock_iam.get_policy_version.return_value = {
            "PolicyVersion": {
                "Document": {
                    "Statement": [{"Effect": "Allow", "Action": ["s3:*"]}]
                }
            }
        }
        mock_iam.list_role_policies.return_value = {"PolicyNames": []}
        # Mock NO permission boundary
        mock_iam.get_role.return_value = {"Role": {}}
        
        # Execute
        results = simulate_actions(role, actions, mock_iam, account_id, resource_arn)
        
        # Verify wildcard action was validated and found exact permission
        assert len(results) == 1
        assert results[0][0] is True  # Success - found exact wildcard permission
        assert "HAS permission 's3:*'" in results[0][1]
    
    def test_action_with_wildcard_only_specific_permissions(self):
        """
        Test when expected is wildcard (e.g., "s3:*") but role only has specific permissions.
        Should FAIL because we require the exact wildcard permission.
        """
        mock_iam = MagicMock()
        role = "TestRole"
        actions = ["s3:*"]
        account_id = "123456789012"
        resource_arn = "arn:aws:s3:::my-bucket/key"
        
        # Mock role only has specific s3 permissions, NOT s3:*
        mock_iam.list_attached_role_policies.return_value = {"AttachedPolicies": [{"PolicyArn": "arn:aws:iam::123456789012:policy/TestPolicy"}]}
        mock_iam.get_policy.return_value = {"Policy": {"DefaultVersionId": "v1"}}
        mock_iam.get_policy_version.return_value = {
            "PolicyVersion": {
                "Document": {
                    "Statement": [{"Effect": "Allow", "Action": ["s3:GetObject", "s3:PutObject"]}]
                }
            }
        }
        mock_iam.list_role_policies.return_value = {"PolicyNames": []}
        
        # Execute
        results = simulate_actions(role, actions, mock_iam, account_id, resource_arn)
        
        # Verify wildcard action FAILED - only specific permissions, not the wildcard
        assert len(results) == 1
        assert results[0][0] is False
        assert "MISSING wildcard permission 's3:*'" in results[0][1]
        assert "specific actions" in results[0][1]
        
    def test_action_with_wildcard_no_matching_permission(self):
        """
        Test when action contains wildcard but role has NO matching permissions.
        Should return failure.
        """
        mock_iam = MagicMock()
        role = "TestRole"
        actions = ["s3:*"]
        account_id = "123456789012"
        resource_arn = "arn:aws:s3:::my-bucket/key"
        
        # Mock role has NO s3 permissions, only ec2 permissions
        mock_iam.list_attached_role_policies.return_value = {"AttachedPolicies": [{"PolicyArn": "arn:aws:iam::123456789012:policy/TestPolicy"}]}
        mock_iam.get_policy.return_value = {"Policy": {"DefaultVersionId": "v1"}}
        mock_iam.get_policy_version.return_value = {
            "PolicyVersion": {
                "Document": {
                    "Statement": [{"Effect": "Allow", "Action": ["ec2:DescribeInstances"]}]
                }
            }
        }
        mock_iam.list_role_policies.return_value = {"PolicyNames": []}
        
        # Execute
        results = simulate_actions(role, actions, mock_iam, account_id, resource_arn)
        
        # Verify wildcard action failed - no matching permissions
        assert len(results) == 1
        assert results[0][0] is False  # Failure - no matching permissions
        assert "MISSING permissions matching 's3:*'" in results[0][1]

    def test_multiple_actions_with_wildcards(self):
        """
        Test multiple actions where some have wildcards and some don't.
        Wildcard actions are validated against actual policies.
        Now requires exact wildcard permissions in policy.
        """
        mock_iam = MagicMock()
        role = "TestRole"
        actions = ["s3:*", "s3:GetObject", "lambda:*"]
        account_id = "123456789012"
        resource_arn = "arn:aws:s3:::my-bucket/key"
        
        # Mock role has s3:* wildcard but NOT lambda permissions
        mock_iam.list_attached_role_policies.return_value = {"AttachedPolicies": [{"PolicyArn": "arn:aws:iam::123456789012:policy/TestPolicy"}]}
        mock_iam.get_policy.return_value = {"Policy": {"DefaultVersionId": "v1"}}
        mock_iam.get_policy_version.return_value = {
            "PolicyVersion": {
                "Document": {
                    "Statement": [{"Effect": "Allow", "Action": ["s3:*"]}]
                }
            }
        }
        mock_iam.list_role_policies.return_value = {"PolicyNames": []}
        # Mock NO permission boundary
        mock_iam.get_role.return_value = {"Role": {}}
        
        # Mock successful IAM simulation for non-wildcard action
        mock_iam.simulate_principal_policy.return_value = {
            "EvaluationResults": [{
                "EvalDecision": "allowed"
            }]
        }
        
        # Execute
        results = simulate_actions(role, actions, mock_iam, account_id, resource_arn)
        
        # Verify 3 results
        assert len(results) == 3
        
        # First action (s3:*) - validated against actual policies, should pass
        assert results[0][0] is True
        assert "HAS permission 's3:*'" in results[0][1]
        
        # Second action (s3:GetObject) - simulated
        assert results[1][0] is True
        assert "ALLOWS 's3:GetObject'" in results[1][1]
        
        # Third action (lambda:*) - should fail, no lambda permissions
        assert results[2][0] is False
        assert "MISSING permissions matching 'lambda:*'" in results[2][1]
        
        # Verify IAM simulation was called only once (for non-wildcard action)
        assert mock_iam.simulate_principal_policy.call_count == 1

    def test_wildcard_action_on_wildcard_resource(self):
        """
        Test combination of wildcard action and wildcard resource.
        Wildcard action should be validated against actual role policies.
        Now requires exact wildcard permission in policy.
        """
        mock_iam = MagicMock()
        role = "TestRole"
        actions = ["s3:*"]
        account_id = "123456789012"
        resource_arn = "*"
        
        # Mock role has s3:* permission (exact wildcard)
        mock_iam.list_attached_role_policies.return_value = {"AttachedPolicies": [{"PolicyArn": "arn:aws:iam::123456789012:policy/TestPolicy"}]}
        mock_iam.get_policy.return_value = {"Policy": {"DefaultVersionId": "v1"}}
        mock_iam.get_policy_version.return_value = {
            "PolicyVersion": {
                "Document": {
                    "Statement": [{"Effect": "Allow", "Action": ["s3:*"]}]
                }
            }
        }
        mock_iam.list_role_policies.return_value = {"PolicyNames": []}
        # Mock NO permission boundary
        mock_iam.get_role.return_value = {"Role": {}}
        
        # Execute
        results = simulate_actions(role, actions, mock_iam, account_id, resource_arn)
        
        # Verify wildcard action was validated against actual permissions
        assert len(results) == 1
        assert results[0][0] is True
        assert "HAS permission 's3:*'" in results[0][1]
        
        # Verify simulate_principal_policy was NOT called (wildcard actions use policy inspection)
        mock_iam.simulate_principal_policy.assert_not_called()

    def test_non_wildcard_action_on_wildcard_resource(self):
        """
        Test non-wildcard action on wildcard resource.
        IAM simulation is always called first for non-wildcard actions.
        """
        mock_iam = MagicMock()
        role = "TestRole"
        actions = ["s3:GetObject"]
        account_id = "123456789012"
        resource_arn = "*"
        
        # Mock successful IAM simulation
        mock_iam.simulate_principal_policy.return_value = {
            "EvaluationResults": [{"EvalDecision": "allowed"}]
        }
        
        # Execute
        results = simulate_actions(role, actions, mock_iam, account_id, resource_arn)
        
        # Verify simulation was called and action allowed
        assert len(results) == 1
        assert results[0][0] is True
        assert "ALLOWS 's3:GetObject'" in results[0][1]
        
        # Verify simulate_principal_policy WAS called
        mock_iam.simulate_principal_policy.assert_called_once()

    def test_multiple_actions_on_wildcard_resource(self):
        """
        Test multiple non-wildcard actions on wildcard resource.
        IAM simulation is always called first for non-wildcard actions.
        """
        mock_iam = MagicMock()
        role = "TestRole"
        actions = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
        account_id = "123456789012"
        resource_arn = "arn:aws:s3:::my-bucket/*"
        
        # Mock successful IAM simulation for all actions
        mock_iam.simulate_principal_policy.return_value = {
            "EvaluationResults": [{"EvalDecision": "allowed"}]
        }
        
        # Execute
        results = simulate_actions(role, actions, mock_iam, account_id, resource_arn)
        
        # Verify all 3 actions were simulated and allowed
        assert len(results) == 3
        for i, action in enumerate(actions):
            assert results[i][0] is True
            assert "ALLOWS" in results[i][1]
        
        # Verify simulate_principal_policy WAS called for each action
        assert mock_iam.simulate_principal_policy.call_count == 3

    def test_resource_arn_with_multiple_wildcards_in_resource_portion(self):
        """
        Test resource_arn with multiple wildcards in resource portion.
        Example: "arn:aws:s3:::my-bucket/*/subfolder/*"
        Actions should be validated against actual role policies.
        """
        mock_iam = MagicMock()
        role = "TestRole"
        actions = ["s3:GetObject"]
        account_id = "123456789012"
        resource_arn = "arn:aws:s3:::my-bucket/*/subfolder/*"
        
        # Mock role has s3:GetObject permission
        # Mock successful IAM simulation
        mock_iam.simulate_principal_policy.return_value = {
            "EvaluationResults": [{"EvalDecision": "allowed"}]
        }
        
        # Execute
        results = simulate_actions(role, actions, mock_iam, account_id, resource_arn)
        
        # Verify simulation was called and action allowed
        assert len(results) == 1
        assert results[0][0] is True
        assert "ALLOWS 's3:GetObject'" in results[0][1]
        
        # Verify simulate_principal_policy WAS called
        mock_iam.simulate_principal_policy.assert_called_once()

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
        - Some wildcard actions (validated against actual policies)
        - Some normal actions (simulated via IAM)
        - Mixture of both
        Now requires exact wildcard permission in policy.
        """
        mock_iam = MagicMock()
        role = "TestRole"
        actions = ["s3:*", "s3:GetObject", "lambda:InvokeFunction"]
        account_id = "123456789012"
        resource_arn = "*"
        
        # Mock role has s3:* wildcard permission (for wildcard action validation and denied action check)
        mock_iam.list_attached_role_policies.return_value = {"AttachedPolicies": [{"PolicyArn": "arn:aws:iam::123456789012:policy/TestPolicy"}]}
        mock_iam.get_policy.return_value = {"Policy": {"DefaultVersionId": "v1"}}
        mock_iam.get_policy_version.return_value = {
            "PolicyVersion": {
                "Document": {
                    "Statement": [{"Effect": "Allow", "Action": ["s3:*"]}]
                }
            }
        }
        mock_iam.list_role_policies.return_value = {"PolicyNames": []}
        
        # Mock NO permission boundary
        mock_iam.get_role.return_value = {"Role": {}}
        
        # Mock IAM simulation - s3:GetObject allowed, lambda:InvokeFunction denied
        def simulate_side_effect(**kwargs):
            action = kwargs["ActionNames"][0]
            if action == "s3:GetObject":
                return {"EvaluationResults": [{"EvalDecision": "allowed"}]}
            else:
                return {"EvaluationResults": [{"EvalDecision": "implicitDeny"}]}
        mock_iam.simulate_principal_policy.side_effect = simulate_side_effect
        
        # Execute
        results = simulate_actions(role, actions, mock_iam, account_id, resource_arn)
        
        # Verify 3 results
        assert len(results) == 3
        
        # First action (s3:*) - validated against actual policies, should pass
        assert results[0][0] is True
        assert "HAS permission 's3:*'" in results[0][1]
        
        # Second action (s3:GetObject) - simulated and allowed
        assert results[1][0] is True
        assert "ALLOWS 's3:GetObject'" in results[1][1]
        
        # Third action (lambda:InvokeFunction) - simulation denied, not in policy → missing
        assert results[2][0] is False
        assert "MISSING permission 'lambda:InvokeFunction'" in results[2][1]
        
        # Verify simulate_principal_policy WAS called for non-wildcard actions (2 times)
        assert mock_iam.simulate_principal_policy.call_count == 2

    def test_permission_boundary_blocks_action_explicit_deny(self):
        """
        Test when action is explicitly denied by permission boundary or SCP.
        Simulation returns explicitDeny → BLOCKED message.
        This ensures explicit denies from permission boundaries are properly detected.
        """
        mock_iam = MagicMock()
        role = "TestRole"
        actions = ["kms:Decrypt"]
        account_id = "123456789012"
        resource_arn = "*"
        
        # Mock IAM simulation returns explicitDeny (blocked by permission boundary explicit deny)
        mock_iam.simulate_principal_policy.return_value = {
            "EvaluationResults": [{"EvalDecision": "explicitDeny"}]
        }
        
        # Execute
        results = simulate_actions(role, actions, mock_iam, account_id, resource_arn)
        
        # Verify action was BLOCKED with explicitDeny
        assert len(results) == 1
        assert results[0][0] is False
        assert "BLOCKED" in results[0][1]
        assert "explicitDeny" in results[0][1]
        
        # Verify simulation WAS called
        mock_iam.simulate_principal_policy.assert_called_once()

    def test_implicit_deny_with_action_in_policy_no_boundary_passes(self):
        """
        Test when simulation returns implicitDeny but action exists in policy and no boundary.
        This is likely a resource constraint mismatch (policy has specific resources, we tested with "*").
        Should pass since the permission exists in the policy and no boundary restricts it.
        """
        mock_iam = MagicMock()
        role = "TestRole"
        actions = ["kms:Decrypt"]
        account_id = "123456789012"
        resource_arn = "*"
        
        # Mock IAM simulation returns implicitDeny (could be resource mismatch)
        mock_iam.simulate_principal_policy.return_value = {
            "EvaluationResults": [{"EvalDecision": "implicitDeny"}]
        }
        
        # Mock role HAS the permission in its policy
        mock_iam.list_attached_role_policies.return_value = {"AttachedPolicies": [{"PolicyArn": "arn:aws:iam::123456789012:policy/TestPolicy"}]}
        mock_iam.get_policy.return_value = {"Policy": {"DefaultVersionId": "v1"}}
        mock_iam.get_policy_version.return_value = {
            "PolicyVersion": {
                "Document": {
                    "Statement": [{"Effect": "Allow", "Action": ["kms:Decrypt", "kms:Encrypt"]}]
                }
            }
        }
        mock_iam.list_role_policies.return_value = {"PolicyNames": []}
        
        # Mock NO permission boundary attached
        mock_iam.get_role.return_value = {"Role": {}}
        
        # Execute
        results = simulate_actions(role, actions, mock_iam, account_id, resource_arn)
        
        # Verify action PASSED (exists in policy, no boundary restricts it)
        assert len(results) == 1
        assert results[0][0] is True
        assert "HAS permission" in results[0][1]
        
        # Verify simulation WAS called
        mock_iam.simulate_principal_policy.assert_called_once()

    def test_implicit_deny_with_action_blocked_by_boundary(self):
        """
        Test when simulation returns implicitDeny and action exists in policy but NOT in boundary.
        Should fail because permission boundary doesn't allow it.
        """
        mock_iam = MagicMock()
        role = "TestRole"
        actions = ["kms:Decrypt"]
        account_id = "123456789012"
        resource_arn = "*"
        
        # Mock IAM simulation returns implicitDeny
        mock_iam.simulate_principal_policy.return_value = {
            "EvaluationResults": [{"EvalDecision": "implicitDeny"}]
        }
        
        # Mock role HAS the permission in its policy
        mock_iam.list_attached_role_policies.return_value = {"AttachedPolicies": [{"PolicyArn": "arn:aws:iam::123456789012:policy/TestPolicy"}]}
        
        # get_policy will be called twice - first for role policy, then for boundary
        def get_policy_side_effect(PolicyArn):
            return {"Policy": {"DefaultVersionId": "v1"}}
        mock_iam.get_policy.side_effect = get_policy_side_effect
        
        # get_policy_version will be called twice
        def get_policy_version_side_effect(PolicyArn, VersionId):
            if "Boundary" in PolicyArn:
                # Boundary does NOT allow kms:Decrypt
                return {"PolicyVersion": {"Document": {"Statement": [{"Effect": "Allow", "Action": ["s3:*", "logs:*"]}]}}}
            else:
                # Role policy has kms:Decrypt
                return {"PolicyVersion": {"Document": {"Statement": [{"Effect": "Allow", "Action": ["kms:Decrypt", "kms:Encrypt"]}]}}}
        mock_iam.get_policy_version.side_effect = get_policy_version_side_effect
        
        mock_iam.list_role_policies.return_value = {"PolicyNames": []}
        
        # Mock permission boundary attached
        mock_iam.get_role.return_value = {
            "Role": {
                "PermissionsBoundary": {
                    "PermissionsBoundaryArn": "arn:aws:iam::123456789012:policy/BoundaryPolicy"
                }
            }
        }
        
        # Execute
        results = simulate_actions(role, actions, mock_iam, account_id, resource_arn)
        
        # Verify action BLOCKED by permission boundary
        assert len(results) == 1
        assert results[0][0] is False
        assert "BLOCKED" in results[0][1]
        assert "permission boundary" in results[0][1].lower()

    def test_action_missing_from_policy_shows_missing(self):
        """
        Test when action doesn't exist in role policy.
        Simulation returns implicitDeny, action not in policy → MISSING message.
        """
        mock_iam = MagicMock()
        role = "TestRole"
        actions = ["kms:Decrypt"]
        account_id = "123456789012"
        resource_arn = "*"
        
        # Mock IAM simulation returns implicitDeny
        mock_iam.simulate_principal_policy.return_value = {
            "EvaluationResults": [{"EvalDecision": "implicitDeny"}]
        }
        
        # Mock role does NOT have the permission
        mock_iam.list_attached_role_policies.return_value = {"AttachedPolicies": [{"PolicyArn": "arn:aws:iam::123456789012:policy/TestPolicy"}]}
        mock_iam.get_policy.return_value = {"Policy": {"DefaultVersionId": "v1"}}
        mock_iam.get_policy_version.return_value = {
            "PolicyVersion": {
                "Document": {
                    "Statement": [{"Effect": "Allow", "Action": ["s3:GetObject"]}]
                }
            }
        }
        mock_iam.list_role_policies.return_value = {"PolicyNames": []}
        
        # Execute
        results = simulate_actions(role, actions, mock_iam, account_id, resource_arn)
        
        # Verify action was MISSING (not in policy)
        assert len(results) == 1
        assert results[0][0] is False
        assert "MISSING" in results[0][1]
        
        # Verify simulation WAS called
        mock_iam.simulate_principal_policy.assert_called_once()

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


class TestWildcardHelperFunctions:
    """Test cases for wildcard validation helper functions"""
    
    def test_match_wildcard_action_simple_prefix(self):
        """Test matching wildcard pattern with simple prefix (e.g., s3:Get*)"""
        actual_actions = {"s3:GetObject", "s3:GetBucket", "s3:PutObject", "ec2:DescribeInstances"}
        
        matched = _match_wildcard_action("s3:Get*", actual_actions)
        
        assert matched == {"s3:GetObject", "s3:GetBucket"}
    
    def test_match_wildcard_action_middle_wildcard(self):
        """Test matching wildcard pattern with wildcard in the middle (e.g., iam:*Role*)"""
        actual_actions = {"iam:CreateRole", "iam:DeleteRole", "iam:GetRole", "iam:ListRoles", "iam:PassRole", "iam:CreateUser"}
        
        matched = _match_wildcard_action("iam:*Role*", actual_actions)
        
        assert "iam:CreateRole" in matched
        assert "iam:DeleteRole" in matched
        assert "iam:GetRole" in matched
        assert "iam:ListRoles" in matched
        assert "iam:PassRole" in matched
        assert "iam:CreateUser" not in matched
    
    def test_match_wildcard_action_full_service_wildcard(self):
        """Test matching full service wildcard (e.g., s3:*)"""
        actual_actions = {"s3:GetObject", "s3:PutObject", "ec2:DescribeInstances"}
        
        matched = _match_wildcard_action("s3:*", actual_actions)
        
        assert matched == {"s3:GetObject", "s3:PutObject"}
    
    def test_match_wildcard_action_actual_has_wildcard(self):
        """Test when actual permission is a wildcard that covers expected pattern"""
        actual_actions = {"s3:*", "ec2:Describe*"}
        
        # s3:* should cover s3:GetObject pattern
        matched = _match_wildcard_action("s3:GetObject", actual_actions)
        assert "s3:*" in matched
        
        # ec2:Describe* should cover ec2:DescribeInstances
        matched = _match_wildcard_action("ec2:Describe*", actual_actions)
        assert "ec2:Describe*" in matched
    
    def test_match_wildcard_action_no_match(self):
        """Test when no actual permissions match the pattern"""
        actual_actions = {"ec2:DescribeInstances", "lambda:InvokeFunction"}
        
        matched = _match_wildcard_action("s3:*", actual_actions)
        
        assert matched == set()
    
    def test_pattern_covers_pattern_full_wildcard(self):
        """Test that full wildcard covers specific patterns"""
        # s3:* covers s3:Get*
        assert _pattern_covers_pattern("s3:*", "s3:Get*") is True
        
        # iam:* covers iam:*Role*
        assert _pattern_covers_pattern("iam:*", "iam:*Role*") is True
    
    def test_pattern_covers_pattern_different_services(self):
        """Test that different services don't cover each other"""
        assert _pattern_covers_pattern("ec2:*", "s3:Get*") is False
    
    def test_get_role_actual_actions_with_attached_policies(self):
        """Test retrieving actions from attached managed policies"""
        mock_iam = MagicMock()
        
        mock_iam.list_attached_role_policies.return_value = {
            "AttachedPolicies": [{"PolicyArn": "arn:aws:iam::123456789012:policy/TestPolicy"}]
        }
        mock_iam.get_policy.return_value = {"Policy": {"DefaultVersionId": "v1"}}
        mock_iam.get_policy_version.return_value = {
            "PolicyVersion": {
                "Document": {
                    "Statement": [
                        {"Effect": "Allow", "Action": ["s3:GetObject", "s3:PutObject"]},
                        {"Effect": "Deny", "Action": ["s3:DeleteObject"]}  # Deny should be ignored
                    ]
                }
            }
        }
        mock_iam.list_role_policies.return_value = {"PolicyNames": []}
        
        actions = _get_role_actual_actions("TestRole", mock_iam)
        
        assert "s3:GetObject" in actions
        assert "s3:PutObject" in actions
        assert "s3:DeleteObject" not in actions  # Deny actions should not be included
    
    def test_get_role_actual_actions_with_inline_policies(self):
        """Test retrieving actions from inline policies"""
        mock_iam = MagicMock()
        
        mock_iam.list_attached_role_policies.return_value = {"AttachedPolicies": []}
        mock_iam.list_role_policies.return_value = {"PolicyNames": ["InlinePolicy"]}
        mock_iam.get_role_policy.return_value = {
            "PolicyDocument": {
                "Statement": [
                    {"Effect": "Allow", "Action": "lambda:InvokeFunction"}
                ]
            }
        }
        
        actions = _get_role_actual_actions("TestRole", mock_iam)
        
        assert "lambda:InvokeFunction" in actions
    
    def test_get_role_actual_actions_failure(self):
        """Test handling when policy retrieval fails"""
        mock_iam = MagicMock()
        mock_iam.list_attached_role_policies.side_effect = ClientError(
            {"Error": {"Code": "AccessDenied", "Message": "Access Denied"}},
            "ListAttachedRolePolicies"
        )
        
        actions = _get_role_actual_actions("TestRole", mock_iam)
        
        assert actions is None


class TestWildcardActionValidationFailure:
    """Test cases for wildcard action validation failures"""
    
    def test_wildcard_action_policy_retrieval_fails(self):
        """Test when policy retrieval fails for wildcard action validation"""
        mock_iam = MagicMock()
        role = "TestRole"
        actions = ["s3:*"]
        account_id = "123456789012"
        resource_arn = "arn:aws:s3:::my-bucket/key"
        
        # Mock policy retrieval failure
        mock_iam.list_attached_role_policies.side_effect = ClientError(
            {"Error": {"Code": "AccessDenied", "Message": "Access Denied"}},
            "ListAttachedRolePolicies"
        )
        
        results = simulate_actions(role, actions, mock_iam, account_id, resource_arn)
        
        assert len(results) == 1
        assert results[0][0] is False
        assert "Could not retrieve policies" in results[0][1]
    
    def test_complex_wildcard_pattern_iam_role_star(self):
        """Test complex wildcard pattern like iam:*Role* with exact wildcard in policy"""
        mock_iam = MagicMock()
        role = "TestRole"
        actions = ["iam:*Role*"]
        account_id = "123456789012"
        resource_arn = "arn:aws:iam::123456789012:role/*"
        
        # Mock role has the exact wildcard permission iam:*Role*
        mock_iam.list_attached_role_policies.return_value = {
            "AttachedPolicies": [{"PolicyArn": "arn:aws:iam::123456789012:policy/TestPolicy"}]
        }
        mock_iam.get_policy.return_value = {"Policy": {"DefaultVersionId": "v1"}}
        mock_iam.get_policy_version.return_value = {
            "PolicyVersion": {
                "Document": {
                    "Statement": [{"Effect": "Allow", "Action": ["iam:*Role*"]}]
                }
            }
        }
        mock_iam.list_role_policies.return_value = {"PolicyNames": []}
        # Mock NO permission boundary
        mock_iam.get_role.return_value = {"Role": {}}
        
        results = simulate_actions(role, actions, mock_iam, account_id, resource_arn)
        
        assert len(results) == 1
        assert results[0][0] is True
        assert "HAS permission 'iam:*Role*'" in results[0][1]
    
    def test_complex_wildcard_pattern_with_broader_wildcard(self):
        """Test complex wildcard pattern like iam:*Role* covered by broader iam:*"""
        mock_iam = MagicMock()
        role = "TestRole"
        actions = ["iam:*Role*"]
        account_id = "123456789012"
        resource_arn = "arn:aws:iam::123456789012:role/*"
        
        # Mock role has broader iam:* permission which covers iam:*Role*
        mock_iam.list_attached_role_policies.return_value = {
            "AttachedPolicies": [{"PolicyArn": "arn:aws:iam::123456789012:policy/TestPolicy"}]
        }
        mock_iam.get_policy.return_value = {"Policy": {"DefaultVersionId": "v1"}}
        mock_iam.get_policy_version.return_value = {
            "PolicyVersion": {
                "Document": {
                    "Statement": [{"Effect": "Allow", "Action": ["iam:*"]}]
                }
            }
        }
        mock_iam.list_role_policies.return_value = {"PolicyNames": []}
        # Mock NO permission boundary
        mock_iam.get_role.return_value = {"Role": {}}
        
        results = simulate_actions(role, actions, mock_iam, account_id, resource_arn)
        
        assert len(results) == 1
        assert results[0][0] is True
        assert "HAS permission 'iam:*'" in results[0][1]
    
    def test_complex_wildcard_pattern_only_specific_permissions(self):
        """Test complex wildcard pattern iam:*Role* fails when only specific actions exist"""
        mock_iam = MagicMock()
        role = "TestRole"
        actions = ["iam:*Role*"]
        account_id = "123456789012"
        resource_arn = "arn:aws:iam::123456789012:role/*"
        
        # Mock role has specific IAM role permissions, NOT the wildcard
        mock_iam.list_attached_role_policies.return_value = {
            "AttachedPolicies": [{"PolicyArn": "arn:aws:iam::123456789012:policy/TestPolicy"}]
        }
        mock_iam.get_policy.return_value = {"Policy": {"DefaultVersionId": "v1"}}
        mock_iam.get_policy_version.return_value = {
            "PolicyVersion": {
                "Document": {
                    "Statement": [{"Effect": "Allow", "Action": ["iam:CreateRole", "iam:DeleteRole", "iam:GetRole"]}]
                }
            }
        }
        mock_iam.list_role_policies.return_value = {"PolicyNames": []}
        
        results = simulate_actions(role, actions, mock_iam, account_id, resource_arn)
        
        assert len(results) == 1
        assert results[0][0] is False
        assert "MISSING wildcard permission 'iam:*Role*'" in results[0][1]
        assert "specific actions" in results[0][1]


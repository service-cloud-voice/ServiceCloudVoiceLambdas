"""
Multi-threaded validation orchestration for AWS Resource Health Check Lambda

Handles parallel execution of resource validation tasks with thread pool management.
"""

from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Dict, List, Set

from models.health_models import HealthCheckInput
from utils.logging_utils import info, ok, warn


class MultiThreadedValidator:
    """
    Multi-threaded resource validator that runs existing validation functions in parallel
    
    This class orchestrates the parallel execution of various AWS resource validation
    tasks, collecting results and managing error handling across threads.
    """
    
    def __init__(self, health_input: HealthCheckInput, config: Dict):
        """
        Initialize the validator with input parameters and configuration
        
        Args:
            health_input: Parsed input parameters for the health check
            config: Expected resources configuration dictionary
        """
        self.health_input = health_input
        self.config = config
        self.results = []
        self.errors = []
        self.warnings = []
        
    def validate_all_resources_parallel(self, all_lambda_names: Set[str]) -> List[Dict]:
        """
        Run all validation functions in parallel using thread pool
        
        Args:
            all_lambda_names: Set of expected Lambda function names for cross-references
            
        Returns:
            List[Dict]: List of validation results from all resource types
        """
        info(f"Starting parallel validation with {self.health_input.max_threads} threads")
        
        # Import validation functions from validators package
        from validators import (
            validate_roles, validate_lambdas, validate_layers, validate_policies,
            validate_alarms, validate_s3, validate_kinesis, validate_kms_aliases,
            validate_triggers_by_lambda_policy,
            validate_event_source_mappings, validate_lambda_permissions
        )
        
        # Create validation tasks - each task is a function call
        validation_tasks = [
            ("roles", lambda: validate_roles(self.config)),
            ("lambdas", lambda: validate_lambdas(self.config, self.health_input)),
            ("layers", lambda: validate_layers(self.config)),
            ("policies", lambda: validate_policies(self.config)),
            ("alarms", lambda: validate_alarms(self.config)),
            ("s3", lambda: validate_s3(self.config)),
            ("kinesis", lambda: validate_kinesis(self.config)),
            ("kms_aliases", lambda: validate_kms_aliases(self.config)),
            ("triggers", lambda: validate_triggers_by_lambda_policy(self.config, all_lambda_names)),
            ("event_mappings", lambda: validate_event_source_mappings(self.config, all_lambda_names)),
            ("lambda_permissions", lambda: validate_lambda_permissions(self.config, all_lambda_names))
        ]
        
        # Execute validations in parallel
        full_report = []
        with ThreadPoolExecutor(max_workers=self.health_input.max_threads) as executor:
            # Submit all tasks
            future_to_task = {
                executor.submit(task_func): task_name 
                for task_name, task_func in validation_tasks
            }
            
            # Collect results as they complete
            for future in as_completed(future_to_task):
                task_name = future_to_task[future]
                try:
                    result = future.result()
                    full_report.append(result)
                    
                    # Log summary for each completed validation
                    resource_type = result.get("ResourceType", "Unknown")
                    health_checks = result.get("DetailedHealthCheck", [])
                    healthy_count = len([hc for hc in health_checks if hc.get("status") == 200])
                    total_count = len(health_checks)
                    
                    ok(f"Completed {resource_type}: {healthy_count}/{total_count} healthy")
                    
                    # Track errors and warnings
                    for health_check in health_checks:
                        if health_check.get("status") != 200:
                            self.errors.append(f"{health_check.get('ResourceName', 'Unknown')}: {health_check.get('message', 'Unknown error')}")
                        
                except Exception as e:
                    error_msg = f"Failed to validate {task_name}: {str(e)}"
                    warn(error_msg)
                    self.errors.append(error_msg)
                    
                    # Add a failed validation result
                    full_report.append({
                        "ResourceType": f"Failed {task_name}",
                        "DetailedHealthCheck": [{
                            "ResourceName": task_name,
                            "status": 500,
                            "message": error_msg
                        }]
                    })
        
        info(f"Parallel validation completed. {len(full_report)} resource types validated")
        return full_report
"""
Report generation utilities for AWS Resource Health Check Lambda

Handles creation of enhanced reports with metadata and formatting for different output types.
"""

import datetime
from typing import Dict, List

from models.health_models import HealthCheckInput


def generate_enhanced_report(health_input: HealthCheckInput, full_report: List[Dict], 
                           execution_id: str, execution_time_ms: float, errors: List[str]) -> Dict:
    """Generate enhanced report with metadata and summary"""
    
    # Calculate summary statistics
    total_resources = 0
    healthy_resources = 0
    unhealthy_resources = 0
    warning_resources = 0
    
    for report in full_report:
        health_checks = report.get("DetailedHealthCheck", [])
        total_resources += len(health_checks)
        for hc in health_checks:
            status = hc.get("status", 500)
            if status == 200:
                healthy_resources += 1
            elif status >= 400:
                unhealthy_resources += 1
            else:
                warning_resources += 1
    
    # Determine overall status
    if unhealthy_resources > 0:
        overall_status = "UNHEALTHY"
    elif warning_resources > 0 or errors:
        overall_status = "WARNING"
    else:
        overall_status = "HEALTHY"
    
    # Build execution metadata based on log level
    from utils.logging_utils import is_debug_enabled
    
    execution_metadata = {
        "execution_id": execution_id,
        "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "version": "refactored_v1.0"
    }
    
    # Only include execution time when debug logging is enabled
    if is_debug_enabled():
        execution_metadata["execution_time_ms"] = execution_time_ms
    
    enhanced_report = {
        "execution_metadata": execution_metadata,
        "input_parameters": {
            "cc_version": health_input.cc_version,
            "cc_name": health_input.cc_name,
            "sku": health_input.sku,
            "execution_id": health_input.execution_id,
            "connect_instance_arn": health_input.connect_instance_arn,
            "region": health_input.region,
            "max_threads": health_input.max_threads
        },
        "summary": {
            "overall_status": overall_status,
            "total_resources": total_resources,
            "healthy": healthy_resources,
            "unhealthy": unhealthy_resources,
            "warnings": warning_resources,
            "error_count": len(errors)
        },
        "detailed_results": full_report,
        "errors": errors
    }
    
    return enhanced_report


def generate_csv_report(report: Dict) -> str:
    """Generate CSV format report from health check results"""
    lines = [
        "ResourceName,ResourceType,Status,Message"
    ]
    
    for resource_type_report in report.get("detailed_results", []):
        resource_type = resource_type_report.get("ResourceType", "Unknown")
        health_checks = resource_type_report.get("DetailedHealthCheck", [])
        
        for health_check in health_checks:
            resource_name = health_check.get("ResourceName", "Unknown")
            status = "HEALTHY" if health_check.get("status") == 200 else "UNHEALTHY"
            message = health_check.get("message", "").replace('"', '""')  # Escape quotes
            
            lines.append(f'"{resource_name}","{resource_type}","{status}","{message}"')
    
    return "\n".join(lines)
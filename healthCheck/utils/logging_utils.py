"""
Logging utilities for AWS Resource Health Check Lambda

Provides standardized logging functions using Python's logging library with proper log levels.
Supports emoji icons for easy CloudWatch log reading and proper log level filtering.
"""

import os
import logging
import sys
from typing import Optional

# Configure logger
logger = logging.getLogger('healthcheck')

def setup_logging() -> None:
    """
    Setup logging configuration based on environment variables.
    
    LOG_LEVEL environment variable controls the logging level:
    - ERROR: Only errors and critical issues
    - WARN/WARNING: Warnings and above  
    - INFO: General information and above
    - DEBUG: Detailed debugging information
    - TRACE: Most verbose logging (treated as DEBUG)
    
    If not set, defaults to INFO level.
    """
    # Get log level from environment
    log_level_str = os.environ.get("LOG_LEVEL", "INFO").upper()
    telemetry_log_level = os.environ.get("_LAMBDA_TELEMETRY_LOG_LEVEL", "").upper()
    
    # Use telemetry log level if LOG_LEVEL is not set
    if not os.environ.get("LOG_LEVEL") and telemetry_log_level:
        log_level_str = telemetry_log_level
    
    # Map string levels to logging constants
    level_mapping = {
        "ERROR": logging.ERROR,
        "WARN": logging.WARNING,
        "WARNING": logging.WARNING,
        "INFO": logging.INFO,
        "DEBUG": logging.DEBUG,
        "TRACE": logging.DEBUG  # Treat TRACE as DEBUG
    }
    
    log_level = level_mapping.get(log_level_str, logging.INFO)
    
    # Clear any existing handlers
    logger.handlers.clear()
    
    # Create handler
    handler = logging.StreamHandler(sys.stdout)
    
    # Create formatter - simpler for Lambda
    formatter = logging.Formatter('%(message)s')
    handler.setFormatter(formatter)
    
    # Configure logger
    logger.addHandler(handler)
    logger.setLevel(log_level)
    logger.propagate = False

def get_logger() -> logging.Logger:
    """Get the configured logger instance."""
    if not logger.handlers:
        setup_logging()
    return logger

def ok(msg: str) -> None:
    """Log a success message at INFO level."""
    get_logger().info(f"SUCCESS: {msg}")

def warn(msg: str) -> None:
    """Log a warning message at WARNING level."""
    get_logger().warning(f"WARNING: {msg}")

def fail(msg: str) -> None:
    """Log an error message at ERROR level."""
    get_logger().error(f"ERROR: {msg}")

def info(msg: str) -> None:
    """Log an informational message at INFO level."""
    get_logger().info(f"INFO: {msg}")

def debug(msg: str) -> None:
    """Log a debug message at DEBUG level."""
    get_logger().debug(f"DEBUG: {msg}")

def is_debug_enabled() -> bool:
    """
    Check if debug/verbose logging is enabled based on AWS Lambda environment.
    
    Returns True if any of these conditions are met:
    - LOG_LEVEL environment variable is set to INFO, DEBUG, or TRACE
    - _LAMBDA_TELEMETRY_LOG_LEVEL is set to INFO, DEBUG, or TRACE
    """
    # Check common log level environment variables
    log_level = os.environ.get("LOG_LEVEL", "").upper()
    telemetry_log_level = os.environ.get("_LAMBDA_TELEMETRY_LOG_LEVEL", "").upper()
    
    debug_levels = {"INFO", "DEBUG", "TRACE"}
    
    return (
        log_level in debug_levels or
        telemetry_log_level in debug_levels
    )

def is_info_enabled() -> bool:
    """Check if INFO level logging is enabled."""
    return get_logger().isEnabledFor(logging.INFO)

def is_debug_level_enabled() -> bool:
    """Check if DEBUG level logging is enabled."""
    return get_logger().isEnabledFor(logging.DEBUG)
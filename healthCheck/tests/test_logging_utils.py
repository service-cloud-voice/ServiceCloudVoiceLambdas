"""
Tests for logging utilities
"""

import pytest
import os
from unittest.mock import patch, MagicMock
from io import StringIO

# Import the module under test
import sys
sys.path.insert(0, '/Users/tkuwar/opt/workspace/aws-integration/lambdas/healthCheck')

from utils.logging_utils import ok, warn, fail, info, debug, is_debug_enabled


class TestLoggingUtils:
    """Test cases for logging utility functions"""

    @patch('utils.logging_utils.get_logger')
    def test_ok_function(self, mock_get_logger):
        """Test ok logging function"""
        mock_logger = MagicMock()
        mock_get_logger.return_value = mock_logger
        
        ok("Test success message")
        mock_logger.info.assert_called_once_with("SUCCESS: Test success message")

    @patch('utils.logging_utils.get_logger')
    def test_warn_function(self, mock_get_logger):
        """Test warn logging function"""
        mock_logger = MagicMock()
        mock_get_logger.return_value = mock_logger
        
        warn("Test warning message")
        mock_logger.warning.assert_called_once_with("WARNING: Test warning message")

    @patch('utils.logging_utils.get_logger')
    def test_fail_function(self, mock_get_logger):
        """Test fail logging function"""
        mock_logger = MagicMock()
        mock_get_logger.return_value = mock_logger
        
        fail("Test error message")
        mock_logger.error.assert_called_once_with("ERROR: Test error message")

    @patch('utils.logging_utils.get_logger')
    def test_info_function(self, mock_get_logger):
        """Test info logging function"""
        mock_logger = MagicMock()
        mock_get_logger.return_value = mock_logger
        
        info("Test info message")
        mock_logger.info.assert_called_once_with("INFO: Test info message")

    @patch('utils.logging_utils.get_logger')
    def test_debug_function(self, mock_get_logger):
        """Test debug logging function"""
        mock_logger = MagicMock()
        mock_get_logger.return_value = mock_logger
        
        debug("Test debug message")
        mock_logger.debug.assert_called_once_with("DEBUG: Test debug message")


class TestIsDebugEnabled:
    """Test cases for debug detection functionality"""

    @patch.dict(os.environ, {"LOG_LEVEL": "INFO"})
    def test_is_debug_enabled_log_level_info(self):
        """Test debug enabled when LOG_LEVEL is INFO"""
        assert is_debug_enabled() == True

    @patch.dict(os.environ, {"LOG_LEVEL": "DEBUG"})
    def test_is_debug_enabled_log_level_debug(self):
        """Test debug enabled when LOG_LEVEL is DEBUG"""
        assert is_debug_enabled() == True

    @patch.dict(os.environ, {"LOG_LEVEL": "TRACE"})
    def test_is_debug_enabled_log_level_trace(self):
        """Test debug enabled when LOG_LEVEL is TRACE"""
        assert is_debug_enabled() == True

    @patch.dict(os.environ, {"LOG_LEVEL": "ERROR"})
    def test_is_debug_enabled_log_level_error(self):
        """Test debug disabled when LOG_LEVEL is ERROR"""
        assert is_debug_enabled() == False

    @patch.dict(os.environ, {"LOG_LEVEL": "WARN"})
    def test_is_debug_enabled_log_level_warn(self):
        """Test debug disabled when LOG_LEVEL is WARN"""
        assert is_debug_enabled() == False

    @patch.dict(os.environ, {"_LAMBDA_TELEMETRY_LOG_LEVEL": "INFO"})
    def test_is_debug_enabled_telemetry_log_level_info(self):
        """Test debug enabled when _LAMBDA_TELEMETRY_LOG_LEVEL is INFO"""
        # Clear LOG_LEVEL to test telemetry level only
        with patch.dict(os.environ, {"LOG_LEVEL": ""}, clear=False):
            assert is_debug_enabled() == True

    @patch.dict(os.environ, {"_LAMBDA_TELEMETRY_LOG_LEVEL": "DEBUG"})
    def test_is_debug_enabled_telemetry_log_level_debug(self):
        """Test debug enabled when _LAMBDA_TELEMETRY_LOG_LEVEL is DEBUG"""
        with patch.dict(os.environ, {"LOG_LEVEL": ""}, clear=False):
            assert is_debug_enabled() == True

    @patch.dict(os.environ, {"_LAMBDA_TELEMETRY_LOG_LEVEL": "TRACE"})
    def test_is_debug_enabled_telemetry_log_level_trace(self):
        """Test debug enabled when _LAMBDA_TELEMETRY_LOG_LEVEL is TRACE"""
        with patch.dict(os.environ, {"LOG_LEVEL": ""}, clear=False):
            assert is_debug_enabled() == True

    @patch.dict(os.environ, {"_LAMBDA_TELEMETRY_LOG_LEVEL": "ERROR"})
    def test_is_debug_enabled_telemetry_log_level_error(self):
        """Test debug disabled when _LAMBDA_TELEMETRY_LOG_LEVEL is ERROR"""
        with patch.dict(os.environ, {"LOG_LEVEL": ""}, clear=False):
            assert is_debug_enabled() == False

    @patch.dict(os.environ, {}, clear=True)
    def test_is_debug_enabled_no_env_vars(self):
        """Test debug disabled when no environment variables are set"""
        assert is_debug_enabled() == False

    @patch.dict(os.environ, {"LOG_LEVEL": ""})
    def test_is_debug_enabled_empty_log_level(self):
        """Test debug disabled when LOG_LEVEL is empty"""
        assert is_debug_enabled() == False

    @patch.dict(os.environ, {"LOG_LEVEL": "info"})  # lowercase
    def test_is_debug_enabled_case_insensitive(self):
        """Test debug enabled with lowercase log level (case insensitive)"""
        assert is_debug_enabled() == True

    @patch.dict(os.environ, {"LOG_LEVEL": "Info"})  # mixed case
    def test_is_debug_enabled_mixed_case(self):
        """Test debug enabled with mixed case log level"""
        assert is_debug_enabled() == True

    @patch.dict(os.environ, {"LOG_LEVEL": "INFO", "_LAMBDA_TELEMETRY_LOG_LEVEL": "ERROR"})
    def test_is_debug_enabled_both_env_vars_one_debug(self):
        """Test debug enabled when one of two env vars is debug level"""
        assert is_debug_enabled() == True

    @patch.dict(os.environ, {"LOG_LEVEL": "ERROR", "_LAMBDA_TELEMETRY_LOG_LEVEL": "TRACE"})
    def test_is_debug_enabled_both_env_vars_other_debug(self):
        """Test debug enabled when the other env var is debug level"""
        assert is_debug_enabled() == True

    @patch.dict(os.environ, {"LOG_LEVEL": "ERROR", "_LAMBDA_TELEMETRY_LOG_LEVEL": "WARN"})
    def test_is_debug_enabled_both_env_vars_neither_debug(self):
        """Test debug disabled when neither env var is debug level"""
        assert is_debug_enabled() == False

    @patch.dict(os.environ, {"LOG_LEVEL": "INVALID_LEVEL"})
    def test_is_debug_enabled_invalid_log_level(self):
        """Test debug disabled with invalid log level"""
        assert is_debug_enabled() == False

    def test_debug_levels_set(self):
        """Test that the debug levels are correctly defined"""
        # This test verifies the internal debug_levels set without directly accessing it
        # We test by checking various log levels
        
        with patch.dict(os.environ, {"LOG_LEVEL": "INFO"}):
            assert is_debug_enabled() == True
            
        with patch.dict(os.environ, {"LOG_LEVEL": "DEBUG"}):
            assert is_debug_enabled() == True
            
        with patch.dict(os.environ, {"LOG_LEVEL": "TRACE"}):
            assert is_debug_enabled() == True
            
        # These should not be in debug_levels
        with patch.dict(os.environ, {"LOG_LEVEL": "ERROR"}):
            assert is_debug_enabled() == False
            
        with patch.dict(os.environ, {"LOG_LEVEL": "WARN"}):
            assert is_debug_enabled() == False
            
        with patch.dict(os.environ, {"LOG_LEVEL": "CRITICAL"}):
            assert is_debug_enabled() == False
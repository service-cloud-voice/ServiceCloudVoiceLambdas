"""
Configuration management for AWS Resource Health Check Lambda

Handles loading and processing of expected resource configurations.
"""

import json
import os
from typing import Dict

from utils.logging_utils import fail


def load_expected_from_layer(sku: str) -> Dict:
    """
    Loads the expected resources JSON file from the attached Lambda Layer.
    
    Args:
        sku: The SKU identifier used to determine which config file to load
        
    Returns:
        Dict: The loaded configuration dictionary
        
    Raises:
        FileNotFoundError: If the configuration file is not found
        json.JSONDecodeError: If the configuration file contains invalid JSON
        
    Example:
        >>> config = load_expected_from_layer("resell")
        # Loads /opt/expected_scv_resources_resell.json from the layer
    """
    EXPECTED_FILE_PATH_IN_LAYER = f"/opt/expected_scv_resources_{sku}.json"
    from utils.logging_utils import debug
    debug(f"Reading configuration from layer path: {EXPECTED_FILE_PATH_IN_LAYER}")
    
    try:
        with open(EXPECTED_FILE_PATH_IN_LAYER, encoding="utf-8") as fh:
            return json.load(fh)
    except FileNotFoundError:
        fail(f"The file '{os.path.basename(EXPECTED_FILE_PATH_IN_LAYER)}' was not found in the layer at '{EXPECTED_FILE_PATH_IN_LAYER}'.")
        fail("Ensure the layer was created correctly and attached to this function.")
        raise
    except json.JSONDecodeError as e:
        fail(f"Error decoding JSON from the layer file: {e}")
        raise
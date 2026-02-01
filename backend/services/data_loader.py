"""
Data Loader Module
==================
Handles loading and validation of 5G fronthaul traffic data.

This module provides utilities for loading historical traffic logs
used in topology inference analysis. Supports both:
- CSV files (legacy/simple format)
- Raw .dat files from Nokia hackathon dataset

All validation is deterministic and produces clear, readable error messages.

"""

import os
import pandas as pd

from .raw_data_parser import load_raw_data


# Required columns for fronthaul traffic analysis
REQUIRED_COLUMNS = ["timestamp", "cell_id", "throughput", "packet_loss"]


def load_data(data_path: str) -> pd.DataFrame:
    """
    Load and validate 5G fronthaul traffic data.
    
    Supports two data sources:
    1. CSV file: Single file with all data
    2. Directory: Folder containing raw .dat files from hackathon dataset
    
    This function performs validation steps:
    1. Checks that the file/directory exists
    2. Loads data from appropriate source
    3. Verifies that all required columns are present
    
    Args:
        data_path (str): Path to CSV file OR directory containing .dat files.
    
    Returns:
        pd.DataFrame: Validated DataFrame with traffic data.
    
    Raises:
        FileNotFoundError: If the path does not exist.
        ValueError: If required columns are missing from the data.
    
    Example:
        >>> df = load_data("data/raw")  # Load from .dat files
        >>> df = load_data("data/sample_data.csv")  # Load from CSV
    """
    
    # Step 1: Validate path existence
    if not os.path.exists(data_path):
        raise FileNotFoundError(
            f"Data path not found: '{data_path}'. "
            f"Please ensure the file/directory exists."
        )
    
    # Step 2: Load data based on path type
    if os.path.isdir(data_path):
        # Load from raw .dat files
        df = load_raw_data(data_path)
    else:
        # Load from CSV file
        df = pd.read_csv(data_path)
    
    # Step 3: Validate required columns
    missing_columns = [col for col in REQUIRED_COLUMNS if col not in df.columns]
    
    if missing_columns:
        raise ValueError(
            f"Missing required columns: {missing_columns}. "
            f"Expected columns: {REQUIRED_COLUMNS}. "
            f"Found columns: {df.columns.tolist()}"
        )
    
    return df

"""
Congestion Detection Module
===========================
Detects congestion events in 5G fronthaul traffic data.

This module provides deterministic congestion detection based on
packet loss metrics. A cell is considered congested when it
experiences any packet loss (packet_loss > 0).

Rationale:
    In 5G fronthaul networks, packet loss is a strong indicator of
    link saturation. When multiple cells share the same Ethernet link
    and that link becomes congested, affected cells exhibit packet loss.
    This simple threshold-based approach provides explainable results
    suitable for academic evaluation.
"""

import pandas as pd


def detect_congestion(df: pd.DataFrame) -> pd.DataFrame:
    """
    Detect congestion events in fronthaul traffic data.
    
    This function adds a boolean 'is_congested' column to the DataFrame.
    A cell is marked as congested when packet_loss > 0.
    
    Logic:
        - is_congested = True  → packet_loss > 0 (cell experiencing loss)
        - is_congested = False → packet_loss == 0 (cell operating normally)
    
    Args:
        df (pd.DataFrame): Traffic data with columns:
            - timestamp: Time of measurement
            - cell_id: Identifier for the cell
            - throughput: Data throughput value
            - packet_loss: Packet loss metric (0 = no loss)
    
    Returns:
        pd.DataFrame: Copy of input DataFrame with added 'is_congested' column.
    
    Raises:
        KeyError: If 'packet_loss' column is missing from input.
    
    Example:
        >>> df = pd.DataFrame({
        ...     'timestamp': ['2026-01-01 00:00', '2026-01-01 00:01'],
        ...     'cell_id': ['cell_1', 'cell_2'],
        ...     'throughput': [100, 95],
        ...     'packet_loss': [0, 5]
        ... })
        >>> result = detect_congestion(df)
        >>> print(result['is_congested'].tolist())
        [False, True]
    """
    
    # Validate required column exists
    if "packet_loss" not in df.columns:
        raise KeyError(
            "Missing required column: 'packet_loss'. "
            "Cannot perform congestion detection without packet loss data."
        )
    
    # Create a copy to avoid modifying the original DataFrame
    result = df.copy()
    
    # Apply congestion detection rule:
    # Any packet loss indicates congestion on the shared link
    result["is_congested"] = result["packet_loss"] > 0
    
    return result

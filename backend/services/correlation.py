"""
Correlation Analysis Module
===========================
Computes pairwise congestion correlation between cells.

This module analyzes how often cells experience congestion together,
which indicates they may share the same Ethernet link. The correlation
metric measures the overlap of congestion events between cell pairs.

Correlation Definition:
    correlation(A, B) = (timestamps where both A and B are congested) /
                        (min of total congested timestamps of A or B)

    This metric ranges from 0.0 to 1.0:
    - 1.0 = Perfect correlation (cells always congest together)
    - 0.0 = No correlation (cells never congest together)

Rationale:
    Cells sharing the same fronthaul link will experience congestion
    simultaneously when that link is saturated. High correlation
    suggests shared infrastructure.

"""

import pandas as pd


def compute_congestion_correlation(df: pd.DataFrame) -> dict:
    """
    Compute pairwise congestion correlation between all cells.
    
    This function calculates how often each pair of cells experiences
    congestion at the same time, normalized by the minimum congestion
    count of either cell.
    
    Formula:
        correlation(A, B) = |congested_timestamps(A) ∩ congested_timestamps(B)|
                            / min(|congested_timestamps(A)|, |congested_timestamps(B)|)
    
    Args:
        df (pd.DataFrame): Traffic data with columns:
            - timestamp: Time of measurement
            - cell_id: Identifier for the cell
            - is_congested: Boolean flag from congestion detection
    
    Returns:
        dict: Nested dictionary of correlation values.
            Structure: {cell_id: {other_cell_id: correlation_value, ...}, ...}
            Self-correlations are excluded.
    
    Raises:
        KeyError: If required columns are missing.
    
    Example:
        >>> result = compute_congestion_correlation(df)
        >>> print(result['cell_1']['cell_2'])
        0.75
    """
    
    # Validate required columns
    required_columns = ["timestamp", "cell_id", "is_congested"]
    missing = [col for col in required_columns if col not in df.columns]
    if missing:
        raise KeyError(
            f"Missing required columns: {missing}. "
            f"Expected: {required_columns}"
        )
    
    # Get unique cell identifiers
    cell_ids = df["cell_id"].unique().tolist()
    
    # Build a set of congested timestamps for each cell
    # This enables efficient set intersection operations
    congested_timestamps = {}
    for cell_id in cell_ids:
        cell_data = df[df["cell_id"] == cell_id]
        congested_times = cell_data[cell_data["is_congested"]]["timestamp"]
        congested_timestamps[cell_id] = set(congested_times)
    
    # Compute pairwise correlation
    correlation_matrix = {}
    
    for cell_a in cell_ids:
        correlation_matrix[cell_a] = {}
        timestamps_a = congested_timestamps[cell_a]
        count_a = len(timestamps_a)
        
        for cell_b in cell_ids:
            # Skip self-correlation
            if cell_a == cell_b:
                continue
            
            timestamps_b = congested_timestamps[cell_b]
            count_b = len(timestamps_b)
            
            # Count timestamps where both cells are congested
            overlap = len(timestamps_a & timestamps_b)
            
            # Compute correlation with safe division
            # Use minimum of the two counts as denominator
            min_count = min(count_a, count_b)
            
            if min_count == 0:
                # No congestion in at least one cell → correlation undefined
                # We set to 0.0 to indicate no evidence of shared link
                correlation = 0.0
            else:
                correlation = overlap / min_count
            
            correlation_matrix[cell_a][cell_b] = round(correlation, 4)
    
    return correlation_matrix

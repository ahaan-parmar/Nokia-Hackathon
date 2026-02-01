"""
Feature Engineering Module for Congestion Prediction
=====================================================
Derives advanced features from raw fronthaul network data for ML-based
congestion prediction. This module is an EXTENSION to the existing
deterministic detection pipeline - it does NOT modify existing data.

Feature Categories Engineered:
1. Recent Throughput History (rolling mean, max, slope)
2. Traffic Burstiness (variance, std deviation)
3. Aggregated Link-Level Load (requires topology inference)
4. Historical Congestion Frequency
5. Time-Window Based Features (last N slots)

Design Principles:
- Non-destructive: Creates NEW dataset, preserves original columns
- Deterministic: Uses fixed random seeds, reproducible results
- Explainable: Each feature has clear interpretation for congestion prediction
"""

import pandas as pd
import numpy as np
from typing import Dict, Optional, List


# -----------------------------------------------------------------------------
# FEATURE ENGINEERING CONSTANTS
# -----------------------------------------------------------------------------

# Rolling window sizes (in number of slots)
# Slots are ~0.5ms each, so window_5 ≈ 2.5ms, window_10 ≈ 5ms, window_20 ≈ 10ms
WINDOW_SIZES = [5, 10, 20]

# Minimum periods required for rolling calculations (avoid NaN at start)
MIN_PERIODS = 1


# -----------------------------------------------------------------------------
# FEATURE 1: Recent Throughput History
# Rationale: Congestion often follows periods of high/increasing throughput
# -----------------------------------------------------------------------------

def compute_throughput_rolling_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Compute rolling window statistics for throughput per cell.
    
    Features added:
    - throughput_mean_{window}: Rolling average throughput
      → High values indicate sustained high load, increasing congestion risk
    
    - throughput_max_{window}: Rolling maximum throughput
      → Captures peak demand within window, spikes often precede congestion
    
    - throughput_slope_{window}: Rate of change (linear regression slope)
      → Positive slope indicates increasing load, potential congestion ahead
    
    Args:
        df: DataFrame with 'timestamp', 'cell_id', 'throughput' columns
    
    Returns:
        DataFrame with original columns plus rolling throughput features
    """
    result = df.copy()
    
    # Sort by cell and timestamp to ensure correct rolling calculation
    result = result.sort_values(['cell_id', 'timestamp']).reset_index(drop=True)
    
    for window in WINDOW_SIZES:
        # Group by cell_id for per-cell rolling calculations
        grouped = result.groupby('cell_id')['throughput']
        
        # Rolling mean: average throughput over last N slots
        result[f'throughput_mean_{window}'] = grouped.transform(
            lambda x: x.rolling(window=window, min_periods=MIN_PERIODS).mean()
        )
        
        # Rolling max: peak throughput in last N slots
        result[f'throughput_max_{window}'] = grouped.transform(
            lambda x: x.rolling(window=window, min_periods=MIN_PERIODS).max()
        )
        
        # Rolling slope: trend direction (positive = increasing)
        # Approximated as (current - mean) / window, indicating deviation from baseline
        result[f'throughput_slope_{window}'] = grouped.transform(
            lambda x: (x - x.rolling(window=window, min_periods=MIN_PERIODS).mean()) / window
        )
    
    return result


# -----------------------------------------------------------------------------
# FEATURE 2: Traffic Burstiness
# Rationale: Bursty traffic is harder to handle than smooth traffic
# -----------------------------------------------------------------------------

def compute_burstiness_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Compute traffic burstiness metrics per cell.
    
    Features added:
    - throughput_std_{window}: Standard deviation of throughput
      → High std indicates bursty, unpredictable traffic patterns
    
    - throughput_var_{window}: Variance of throughput
      → Squared measure of variability, emphasizes large deviations
    
    - burstiness_coef_{window}: Coefficient of variation (std/mean)
      → Normalized burstiness, comparable across different traffic levels
    
    Args:
        df: DataFrame with throughput data
    
    Returns:
        DataFrame with burstiness features added
    """
    result = df.copy()
    
    for window in WINDOW_SIZES:
        grouped = result.groupby('cell_id')['throughput']
        
        # Standard deviation: raw variability measure
        result[f'throughput_std_{window}'] = grouped.transform(
            lambda x: x.rolling(window=window, min_periods=MIN_PERIODS).std()
        )
        
        # Variance: emphasizes large deviations
        result[f'throughput_var_{window}'] = grouped.transform(
            lambda x: x.rolling(window=window, min_periods=MIN_PERIODS).var()
        )
        
        # Coefficient of variation: normalized burstiness
        # Avoid division by zero with epsilon
        mean_col = f'throughput_mean_{window}'
        std_col = f'throughput_std_{window}'
        
        if mean_col in result.columns:
            result[f'burstiness_coef_{window}'] = (
                result[std_col] / (result[mean_col] + 1e-10)
            )
    
    return result


# -----------------------------------------------------------------------------
# FEATURE 3: Aggregated Link-Level Load
# Rationale: Cells sharing links compete for bandwidth
# -----------------------------------------------------------------------------

def compute_link_load_features(df: pd.DataFrame, 
                               topology: Optional[Dict[str, str]] = None) -> pd.DataFrame:
    """
    Compute aggregated load metrics for cells sharing the same link.
    
    Features added:
    - link_total_throughput: Sum of throughput across all cells on same link
      → Measures total demand on the shared resource
    
    - link_cell_count: Number of cells on the same link
      → More cells = more competition for bandwidth
    
    - link_avg_throughput: Average throughput per cell on the link
      → Per-cell share of the link capacity
    
    - link_congestion_ratio: Ratio of congested cells on the link
      → If neighbors are congested, this cell is at higher risk
    
    Args:
        df: DataFrame with traffic data
        topology: Dictionary mapping cell_id to link_id (from topology inference)
                 If None, assumes all cells are on separate links
    
    Returns:
        DataFrame with link-level aggregated features
    """
    result = df.copy()
    
    # If no topology provided, use individual links (no aggregation benefit)
    if topology is None:
        result['link_id'] = result['cell_id']
    else:
        result['link_id'] = result['cell_id'].map(topology)
        # Handle cells not in topology (assign to individual links)
        result['link_id'] = result['link_id'].fillna(result['cell_id'])
    
    # Aggregate by timestamp and link
    link_agg = result.groupby(['timestamp', 'link_id']).agg({
        'throughput': ['sum', 'mean', 'count'],
        'packet_loss': lambda x: (x > 0).sum()  # Count of congested cells
    }).reset_index()
    
    # Flatten column names
    link_agg.columns = ['timestamp', 'link_id', 'link_total_throughput', 
                        'link_avg_throughput', 'link_cell_count', 'link_congested_cells']
    
    # Calculate congestion ratio
    link_agg['link_congestion_ratio'] = (
        link_agg['link_congested_cells'] / link_agg['link_cell_count']
    )
    
    # Merge back to original data
    result = result.merge(
        link_agg[['timestamp', 'link_id', 'link_total_throughput', 
                  'link_avg_throughput', 'link_cell_count', 'link_congestion_ratio']],
        on=['timestamp', 'link_id'],
        how='left'
    )
    
    # Drop intermediate link_id column (keep original cell_id)
    result = result.drop(columns=['link_id'])
    
    return result


# -----------------------------------------------------------------------------
# FEATURE 4: Historical Congestion Frequency
# Rationale: Cells with frequent past congestion are more likely to congest again
# -----------------------------------------------------------------------------

def compute_congestion_history_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Compute historical congestion frequency features per cell.
    
    Features added:
    - congestion_freq_{window}: Fraction of slots with congestion in window
      → High frequency indicates problematic cell/link
    
    - slots_since_last_congestion: Number of slots since last congestion event
      → Lower values indicate active/recent congestion episode
    
    - congestion_count_{window}: Total congestion events in window
      → Raw count of recent congestion occurrences
    
    Args:
        df: DataFrame with packet_loss column
    
    Returns:
        DataFrame with congestion history features
    """
    result = df.copy()
    
    # Create binary congestion indicator
    result['_is_congested'] = (result['packet_loss'] > 0).astype(int)
    
    # Sort for proper rolling calculation
    result = result.sort_values(['cell_id', 'timestamp']).reset_index(drop=True)
    
    for window in WINDOW_SIZES:
        grouped = result.groupby('cell_id')['_is_congested']
        
        # Congestion frequency: ratio of congested slots
        result[f'congestion_freq_{window}'] = grouped.transform(
            lambda x: x.rolling(window=window, min_periods=MIN_PERIODS).mean()
        )
        
        # Congestion count: absolute number of congestion events
        result[f'congestion_count_{window}'] = grouped.transform(
            lambda x: x.rolling(window=window, min_periods=MIN_PERIODS).sum()
        )
    
    # Slots since last congestion
    # Use cumulative count with reset on congestion
    def slots_since_congestion(group):
        """Calculate slots since last congestion event."""
        slots_since = []
        counter = 0
        for is_cong in group:
            if is_cong:
                counter = 0
            slots_since.append(counter)
            counter += 1
        return slots_since
    
    result['slots_since_last_congestion'] = result.groupby('cell_id')['_is_congested'].transform(
        lambda x: slots_since_congestion(x)
    )
    
    # Drop temporary column
    result = result.drop(columns=['_is_congested'])
    
    return result


# -----------------------------------------------------------------------------
# FEATURE 5: Time-Window Based Features
# Rationale: Captures temporal patterns and lag effects
# -----------------------------------------------------------------------------

def compute_temporal_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Compute time-window based features for temporal pattern capture.
    
    Features added:
    - throughput_lag_{n}: Throughput value from N slots ago
      → Captures delayed effects and patterns
    
    - throughput_diff_{n}: Change from N slots ago
      → Captures rate of change over different horizons
    
    - throughput_pct_change_{n}: Percentage change from N slots ago
      → Normalized rate of change
    
    - packet_loss_lag_{n}: Packet loss from N slots ago
      → Past congestion indicator
    
    Args:
        df: DataFrame with throughput and packet_loss data
    
    Returns:
        DataFrame with temporal lag features
    """
    result = df.copy()
    
    # Sort for proper lag calculation
    result = result.sort_values(['cell_id', 'timestamp']).reset_index(drop=True)
    
    # Lag periods to use
    lag_periods = [1, 2, 3, 5, 10]
    
    for lag in lag_periods:
        grouped = result.groupby('cell_id')
        
        # Throughput lags
        result[f'throughput_lag_{lag}'] = grouped['throughput'].shift(lag)
        
        # Throughput difference
        result[f'throughput_diff_{lag}'] = (
            result['throughput'] - result[f'throughput_lag_{lag}']
        )
        
        # Percentage change (with epsilon to avoid division by zero)
        result[f'throughput_pct_change_{lag}'] = (
            result[f'throughput_diff_{lag}'] / 
            (result[f'throughput_lag_{lag}'] + 1e-10)
        )
        
        # Packet loss lag (was there congestion N slots ago?)
        result[f'packet_loss_lag_{lag}'] = grouped['packet_loss'].shift(lag)
    
    return result


# -----------------------------------------------------------------------------
# COMBINED FEATURE ENGINEERING PIPELINE
# -----------------------------------------------------------------------------

def engineer_features(df: pd.DataFrame, 
                     topology: Optional[Dict[str, str]] = None,
                     verbose: bool = True) -> pd.DataFrame:
    """
    Apply complete feature engineering pipeline to raw data.
    
    This is the main entry point for feature engineering. It applies all
    feature categories in sequence, preserving original columns and adding
    new engineered features.
    
    Pipeline Steps:
    1. Throughput rolling statistics (mean, max, slope)
    2. Burstiness metrics (std, var, coefficient of variation)
    3. Link-level load aggregation (if topology provided)
    4. Historical congestion frequency
    5. Temporal lag features
    
    Args:
        df: Raw DataFrame with columns: timestamp, cell_id, throughput, packet_loss
        topology: Optional topology mapping from topology inference module
        verbose: Whether to print progress messages
    
    Returns:
        DataFrame with original columns plus all engineered features
        
    Example:
        >>> from services.feature_engineering import engineer_features
        >>> df_features = engineer_features(df_raw, topology=inferred_topology)
        >>> df_features.to_csv('congestion_features_v2.csv', index=False)
    """
    if verbose:
        print("[Feature Engineering] Starting pipeline...")
        print(f"  Input shape: {df.shape}")
    
    # Step 1: Throughput rolling features
    if verbose:
        print("  [1/5] Computing throughput rolling features...")
    result = compute_throughput_rolling_features(df)
    
    # Step 2: Burstiness features
    if verbose:
        print("  [2/5] Computing burstiness features...")
    result = compute_burstiness_features(result)
    
    # Step 3: Link-level load features
    if verbose:
        print("  [3/5] Computing link-level load features...")
    result = compute_link_load_features(result, topology)
    
    # Step 4: Historical congestion frequency
    if verbose:
        print("  [4/5] Computing historical congestion features...")
    result = compute_congestion_history_features(result)
    
    # Step 5: Temporal lag features
    if verbose:
        print("  [5/5] Computing temporal lag features...")
    result = compute_temporal_features(result)
    
    # Fill NaN values created by rolling/lag operations
    # Using forward fill within each cell, then backward fill for remaining
    result = result.groupby('cell_id').apply(
        lambda x: x.ffill().bfill()
    ).reset_index(drop=True)
    
    # Any remaining NaN (e.g., first rows) fill with 0
    result = result.fillna(0)
    
    if verbose:
        print(f"  Output shape: {result.shape}")
        print(f"  New features added: {result.shape[1] - df.shape[1]}")
        print("[Feature Engineering] Pipeline complete.")
    
    return result


def get_feature_descriptions() -> Dict[str, str]:
    """
    Get descriptions of all engineered features.
    
    Returns:
        Dictionary mapping feature name to description
    """
    descriptions = {}
    
    # Throughput rolling features
    for window in WINDOW_SIZES:
        descriptions[f'throughput_mean_{window}'] = (
            f"Rolling average throughput over last {window} slots. "
            "Higher values indicate sustained high load."
        )
        descriptions[f'throughput_max_{window}'] = (
            f"Peak throughput in last {window} slots. "
            "Captures demand spikes that may cause congestion."
        )
        descriptions[f'throughput_slope_{window}'] = (
            f"Throughput trend over {window} slots. "
            "Positive values indicate increasing load."
        )
    
    # Burstiness features
    for window in WINDOW_SIZES:
        descriptions[f'throughput_std_{window}'] = (
            f"Standard deviation of throughput over {window} slots. "
            "High values indicate bursty, unpredictable traffic."
        )
        descriptions[f'throughput_var_{window}'] = (
            f"Variance of throughput over {window} slots. "
            "Emphasizes large deviations from mean."
        )
        descriptions[f'burstiness_coef_{window}'] = (
            f"Coefficient of variation over {window} slots. "
            "Normalized burstiness measure."
        )
    
    # Link-level features
    descriptions['link_total_throughput'] = (
        "Total throughput across all cells on the same link. "
        "Higher values indicate more competition for shared bandwidth."
    )
    descriptions['link_avg_throughput'] = (
        "Average throughput per cell on the shared link. "
        "Indicates per-cell share of link capacity."
    )
    descriptions['link_cell_count'] = (
        "Number of cells sharing the same link. "
        "More cells mean more contention."
    )
    descriptions['link_congestion_ratio'] = (
        "Fraction of cells on the link that are congested. "
        "High ratio indicates link-wide congestion."
    )
    
    # Congestion history features
    for window in WINDOW_SIZES:
        descriptions[f'congestion_freq_{window}'] = (
            f"Fraction of congested slots in last {window} slots. "
            "Historical congestion propensity."
        )
        descriptions[f'congestion_count_{window}'] = (
            f"Number of congestion events in last {window} slots. "
            "Raw congestion count."
        )
    descriptions['slots_since_last_congestion'] = (
        "Number of slots since last congestion event. "
        "Lower values indicate active congestion episode."
    )
    
    # Temporal lag features
    for lag in [1, 2, 3, 5, 10]:
        descriptions[f'throughput_lag_{lag}'] = (
            f"Throughput value from {lag} slots ago. "
            "Captures delayed temporal patterns."
        )
        descriptions[f'throughput_diff_{lag}'] = (
            f"Throughput change from {lag} slots ago. "
            "Rate of change indicator."
        )
        descriptions[f'throughput_pct_change_{lag}'] = (
            f"Percentage throughput change from {lag} slots ago. "
            "Normalized rate of change."
        )
        descriptions[f'packet_loss_lag_{lag}'] = (
            f"Packet loss from {lag} slots ago. "
            "Past congestion indicator."
        )
    
    return descriptions


def get_feature_list() -> List[str]:
    """
    Get list of all feature names for ML model training.
    
    Returns:
        List of feature column names (excludes original columns and target)
    """
    features = []
    
    # Throughput rolling features
    for window in WINDOW_SIZES:
        features.extend([
            f'throughput_mean_{window}',
            f'throughput_max_{window}',
            f'throughput_slope_{window}',
            f'throughput_std_{window}',
            f'throughput_var_{window}',
            f'burstiness_coef_{window}'
        ])
    
    # Link-level features
    features.extend([
        'link_total_throughput',
        'link_avg_throughput',
        'link_cell_count',
        'link_congestion_ratio'
    ])
    
    # Congestion history features
    for window in WINDOW_SIZES:
        features.extend([
            f'congestion_freq_{window}',
            f'congestion_count_{window}'
        ])
    features.append('slots_since_last_congestion')
    
    # Temporal lag features
    for lag in [1, 2, 3, 5, 10]:
        features.extend([
            f'throughput_lag_{lag}',
            f'throughput_diff_{lag}',
            f'throughput_pct_change_{lag}',
            f'packet_loss_lag_{lag}'
        ])
    
    # Also include original throughput as a feature
    features.append('throughput')
    
    return features

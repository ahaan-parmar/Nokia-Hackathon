"""
Raw Data Parser Module
======================
Parses Nokia 5G fronthaul .dat files into analysis-ready DataFrames.

This module handles the raw data format from the hackathon dataset:
- pkt-stats-cell-<id>.dat: Packet statistics per slot (14 symbols)
- throughput-cell-<id>.dat: Throughput per symbol (~35.7μs intervals)

Data is merged and aggregated to provide:
- timestamp: Slot start time
- cell_id: Cell identifier (1-24)
- throughput: Aggregated throughput per slot (kbit)
- packet_loss: txPackets - rxPackets + tooLateRxPackets
"""

import os
import glob
import pandas as pd
import numpy as np


def parse_pkt_stats_file(filepath: str, cell_id: str) -> pd.DataFrame:
    """
    Parse a single pkt-stats-cell-<id>.dat file.
    
    File format (space-separated, 4 columns):
        timestamp | txPackets | rxPackets | tooLateRxPackets
    
    Args:
        filepath: Path to the .dat file
        cell_id: Cell identifier to add as column
    
    Returns:
        DataFrame with columns: timestamp, cell_id, txPackets, rxPackets, 
                                tooLateRxPackets, packet_loss
    """
    # Read file, skip header row
    df = pd.read_csv(
        filepath,
        sep=r'\s+',
        skiprows=1,
        names=['timestamp', 'txPackets', 'rxPackets', 'tooLateRxPackets'],
        dtype={'timestamp': float, 'txPackets': int, 'rxPackets': int, 'tooLateRxPackets': int}
    )
    
    # Add cell identifier
    df['cell_id'] = cell_id
    
    # Calculate packet loss:
    # Lost = transmitted but not received + received too late
    df['packet_loss'] = (df['txPackets'] - df['rxPackets']) + df['tooLateRxPackets']
    
    # Ensure packet_loss is non-negative (handle measurement anomalies)
    df['packet_loss'] = df['packet_loss'].clip(lower=0)
    
    return df


def parse_throughput_file(filepath: str, cell_id: str) -> pd.DataFrame:
    """
    Parse a single throughput-cell-<id>.dat file.
    
    File format (space-separated, 2 columns):
        timestamp | bits_kbit
    
    Note: Data may be unsorted and contain outliers.
    
    Args:
        filepath: Path to the .dat file
        cell_id: Cell identifier to add as column
    
    Returns:
        DataFrame with columns: timestamp, cell_id, throughput_kbit
    """
    # Read file (no header)
    df = pd.read_csv(
        filepath,
        sep=r'\s+',
        names=['timestamp', 'throughput_kbit'],
        dtype={'timestamp': float, 'throughput_kbit': float}
    )
    
    # Add cell identifier
    df['cell_id'] = cell_id
    
    # Sort by timestamp (as recommended in README)
    df = df.sort_values('timestamp').reset_index(drop=True)
    
    # Remove outliers: values significantly higher than typical
    # Using IQR method to detect outliers
    q75 = df['throughput_kbit'].quantile(0.75)
    q25 = df['throughput_kbit'].quantile(0.25)
    iqr = q75 - q25
    upper_bound = q75 + 3 * iqr  # Conservative threshold
    
    # Replace outliers with 0 (as recommended in README)
    df.loc[df['throughput_kbit'] > upper_bound, 'throughput_kbit'] = 0
    
    return df


def parse_throughput_file_indexed(filepath: str, cell_id: str) -> pd.DataFrame:
    """
    Parse a single throughput-cell-<id>.dat file with sequential symbol indexing.
    
    This version outputs symbol-indexed data suitable for slot conversion.
    Each row represents one symbol measurement.
    
    File format (space-separated, 2 columns):
        timestamp | bits_kbit
    
    Args:
        filepath: Path to the .dat file
        cell_id: Cell identifier to add as column
    
    Returns:
        DataFrame with columns:
            - cell_id: cell identifier
            - symbol_index: sequential index starting from 0
            - throughput_bits: throughput in bits (converted from kbit)
    """
    # read file (no header)
    df = pd.read_csv(
        filepath,
        sep=r'\s+',
        names=['timestamp', 'throughput_kbit'],
        dtype={'timestamp': float, 'throughput_kbit': float}
    )
    
    # sort by timestamp (as recommended in README)
    df = df.sort_values('timestamp').reset_index(drop=True)
    
    # remove outliers: values significantly higher than typical
    # using IQR method to detect outliers
    q75 = df['throughput_kbit'].quantile(0.75)
    q25 = df['throughput_kbit'].quantile(0.25)
    iqr = q75 - q25
    upper_bound = q75 + 3 * iqr  # conservative threshold
    
    # replace outliers with 0 (as recommended in README)
    df.loc[df['throughput_kbit'] > upper_bound, 'throughput_kbit'] = 0
    
    # generate sequential symbol index (0, 1, 2, ...)
    df['symbol_index'] = range(len(df))
    
    # convert kbit to bits (1 kbit = 1000 bits)
    df['throughput_bits'] = df['throughput_kbit'] * 1000
    
    # add cell identifier
    df['cell_id'] = cell_id
    
    # return only required columns
    return df[['cell_id', 'symbol_index', 'throughput_bits']]


def load_all_pkt_stats(data_dir: str) -> pd.DataFrame:
    """
    Load all pkt-stats-cell-*.dat files from a directory.
    
    Args:
        data_dir: Path to directory containing .dat files
    
    Returns:
        Combined DataFrame with packet statistics for all cells
    """
    pattern = os.path.join(data_dir, 'pkt-stats-cell-*.dat')
    files = glob.glob(pattern)
    
    if not files:
        raise FileNotFoundError(f"No pkt-stats files found in {data_dir}")
    
    all_data = []
    for filepath in files:
        # Extract cell ID from filename (e.g., "pkt-stats-cell-1.dat" -> "cell_1")
        filename = os.path.basename(filepath)
        cell_num = filename.replace('pkt-stats-cell-', '').replace('.dat', '')
        cell_id = f"cell_{cell_num}"
        
        df = parse_pkt_stats_file(filepath, cell_id)
        all_data.append(df)
    
    combined = pd.concat(all_data, ignore_index=True)
    return combined


def load_all_throughput(data_dir: str) -> pd.DataFrame:
    """
    Load all throughput-cell-*.dat files from a directory.
    
    Args:
        data_dir: Path to directory containing .dat files
    
    Returns:
        Combined DataFrame with throughput data for all cells
    """
    pattern = os.path.join(data_dir, 'throughput-cell-*.dat')
    files = glob.glob(pattern)
    
    if not files:
        raise FileNotFoundError(f"No throughput files found in {data_dir}")
    
    all_data = []
    for filepath in files:
        # Extract cell ID from filename
        filename = os.path.basename(filepath)
        cell_num = filename.replace('throughput-cell-', '').replace('.dat', '')
        cell_id = f"cell_{cell_num}"
        
        df = parse_throughput_file(filepath, cell_id)
        all_data.append(df)
    
    combined = pd.concat(all_data, ignore_index=True)
    return combined


def load_all_throughput_indexed(data_dir: str) -> pd.DataFrame:
    """
    Load all throughput-cell-*.dat files with sequential symbol indexing.
    
    This function produces symbol-indexed data suitable for slot conversion.
    Each cell's symbols are indexed independently starting from 0.
    
    Args:
        data_dir: Path to directory containing .dat files
    
    Returns:
        Combined DataFrame with columns:
            - cell_id: cell identifier
            - symbol_index: sequential index (per cell, starting from 0)
            - throughput_bits: throughput in bits
    """
    pattern = os.path.join(data_dir, 'throughput-cell-*.dat')
    files = glob.glob(pattern)
    
    if not files:
        raise FileNotFoundError(f"No throughput files found in {data_dir}")
    
    all_data = []
    for filepath in files:
        # extract cell ID from filename
        filename = os.path.basename(filepath)
        cell_num = filename.replace('throughput-cell-', '').replace('.dat', '')
        cell_id = f"cell_{cell_num}"
        
        df = parse_throughput_file_indexed(filepath, cell_id)
        all_data.append(df)
    
    combined = pd.concat(all_data, ignore_index=True)
    
    # sort by cell_id and symbol_index for consistency
    combined = combined.sort_values(['cell_id', 'symbol_index']).reset_index(drop=True)
    
    return combined


def load_raw_data(data_dir: str) -> pd.DataFrame:
    """
    Load and merge all raw .dat files into analysis-ready format.
    
    This function:
    1. Loads all pkt-stats files (packet loss data)
    2. Aggregates throughput data to slot level (optional, for future use)
    3. Returns merged DataFrame ready for congestion analysis
    
    Args:
        data_dir: Path to directory containing raw .dat files
    
    Returns:
        DataFrame with columns: timestamp, cell_id, throughput, packet_loss
        Ready for use with the analysis pipeline.
    """
    # Load packet statistics (primary data source for congestion)
    pkt_stats = load_all_pkt_stats(data_dir)
    
    # For Evaluation-1, we use packet stats as primary data source
    # Throughput aggregation can be added later if needed
    
    # Prepare output format matching pipeline expectations
    result = pd.DataFrame({
        'timestamp': pkt_stats['timestamp'],
        'cell_id': pkt_stats['cell_id'],
        'throughput': pkt_stats['txPackets'],  # Using txPackets as throughput proxy
        'packet_loss': pkt_stats['packet_loss']
    })
    
    return result


def get_data_summary(data_dir: str) -> dict:
    """
    Get summary statistics about the raw data.
    
    Args:
        data_dir: Path to directory containing raw .dat files
    
    Returns:
        Dictionary with data summary statistics
    """
    pkt_files = glob.glob(os.path.join(data_dir, 'pkt-stats-cell-*.dat'))
    tput_files = glob.glob(os.path.join(data_dir, 'throughput-cell-*.dat'))
    
    return {
        "pkt_stats_files": len(pkt_files),
        "throughput_files": len(tput_files),
        "total_cells": len(pkt_files),
        "data_directory": data_dir
    }

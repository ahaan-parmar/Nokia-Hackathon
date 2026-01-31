"""
slot conversion module
======================
converts symbol-level throughput data to slot-level aggregation.

in 5g fronthaul networks:
- symbol duration: ~35.7 µs (500 µs / 14)
- slot duration: 500 µs
- 1 slot = 14 symbols

this module aggregates throughput measurements from symbol granularity
to slot granularity, which is required for capacity estimation.

author: nokia hackathon team
date: january 2026
"""

import pandas as pd


# slot configuration constant
SYMBOLS_PER_SLOT = 14


def convert_symbols_to_slots(df: pd.DataFrame) -> pd.DataFrame:
    """
    convert symbol-level throughput data to slot-level aggregation.
    
    groups every 14 consecutive symbols into one slot and sums their
    throughput values. this is a prerequisite for link capacity analysis.
    
    args:
        df (pd.DataFrame): symbol-level data with columns:
            - cell_id: cell identifier
            - symbol_index: sequential symbol index (0, 1, 2, ...)
            - throughput_bits: traffic per symbol in bits
    
    returns:
        pd.DataFrame: slot-level data with columns:
            - slot_id: integer slot index (starting from 0)
            - cell_id: cell identifier
            - slot_throughput_bits: sum of throughput for all 14 symbols in slot
    
    raises:
        KeyError: if required columns are missing
    
    example:
        >>> # input: 28 symbols (2 slots worth)
        >>> df = pd.DataFrame({
        ...     'cell_id': ['cell_1'] * 28,
        ...     'symbol_index': list(range(28)),
        ...     'throughput_bits': [1000] * 28
        ... })
        >>> result = convert_symbols_to_slots(df)
        >>> print(result)
           slot_id cell_id  slot_throughput_bits
        0        0  cell_1                 14000
        1        1  cell_1                 14000
    """
    
    # validate required columns
    required_columns = ["cell_id", "symbol_index", "throughput_bits"]
    missing = [col for col in required_columns if col not in df.columns]
    if missing:
        raise KeyError(
            f"missing required columns: {missing}. "
            f"expected: {required_columns}"
        )
    
    # work on a copy to avoid modifying input
    data = df.copy()
    
    # sort by cell_id and symbol_index for consistent grouping
    data = data.sort_values(["cell_id", "symbol_index"]).reset_index(drop=True)
    
    # compute slot_id: integer division of symbol_index by 14
    # symbol 0-13 -> slot 0, symbol 14-27 -> slot 1, etc.
    data["slot_id"] = data["symbol_index"] // SYMBOLS_PER_SLOT
    
    # aggregate: sum throughput for all symbols in each slot
    slot_data = (
        data.groupby(["cell_id", "slot_id"], as_index=False)
        .agg(slot_throughput_bits=("throughput_bits", "sum"))
    )
    
    # reorder columns for clarity
    slot_data = slot_data[["slot_id", "cell_id", "slot_throughput_bits"]]
    
    # sort output for deterministic results
    slot_data = slot_data.sort_values(["cell_id", "slot_id"]).reset_index(drop=True)
    
    return slot_data


def get_slot_count(df: pd.DataFrame) -> dict:
    """
    get summary statistics about slot conversion.
    
    args:
        df (pd.DataFrame): slot-level data from convert_symbols_to_slots()
    
    returns:
        dict: summary with total slots and slots per cell
    """
    total_slots = df["slot_id"].nunique()
    slots_per_cell = df.groupby("cell_id")["slot_id"].nunique().to_dict()
    
    return {
        "total_unique_slots": total_slots,
        "slots_per_cell": slots_per_cell,
        "symbols_per_slot": SYMBOLS_PER_SLOT
    }

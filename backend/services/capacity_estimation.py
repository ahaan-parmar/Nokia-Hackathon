"""
capacity estimation module
==========================
estimates required link capacity from aggregated traffic data.

this module provides capacity estimation for fronthaul links based on
observed traffic patterns. the no-buffer case requires capacity equal
to peak traffic to avoid any packet loss.

capacity estimation approaches:
    1. no buffer: capacity = max(traffic) across all slots
    2. with buffer: capacity can be lower if bursts are absorbed (separate function)

author: nokia hackathon team
date: january 2026
"""

import pandas as pd


def estimate_capacity_no_buffer(link_traffic_df: pd.DataFrame) -> dict:
    """
    estimate required link capacity without buffering.
    
    in the no-buffer scenario, the link must handle peak instantaneous
    traffic without any queuing. therefore, required capacity equals
    the maximum observed traffic across all slots.
    
    formula:
        required_capacity = max(slot_traffic) for each link
    
    args:
        link_traffic_df (pd.DataFrame): aggregated traffic with columns:
            - slot_id: slot index
            - Link_X_bits: traffic per link in bits (one or more columns)
    
    returns:
        dict: mapping of link name to required capacity in bits
            e.g., {"Link_1": 50000000, "Link_2": 42000000}
    
    example:
        >>> df = pd.DataFrame({
        ...     'slot_id': [0, 1, 2],
        ...     'Link_1_bits': [1000, 2000, 1500],
        ...     'Link_2_bits': [800, 900, 1200]
        ... })
        >>> estimate_capacity_no_buffer(df)
        {'Link_1': 2000, 'Link_2': 1200}
    """
    
    # identify link columns (ending with _bits)
    link_columns = [col for col in link_traffic_df.columns if col.endswith("_bits")]
    
    if not link_columns:
        raise ValueError(
            "no link columns found. expected columns ending with '_bits'. "
            f"found columns: {link_traffic_df.columns.tolist()}"
        )
    
    # compute max traffic per link
    capacity = {}
    for col in link_columns:
        # extract link name by removing _bits suffix
        link_name = col.replace("_bits", "")
        
        # max traffic = required capacity (no buffer case)
        max_traffic = link_traffic_df[col].max()
        
        capacity[link_name] = float(max_traffic)
    
    return capacity


def format_capacity_report(capacity: dict, unit: str = "bits") -> str:
    """
    format capacity estimation results as a readable report.
    
    args:
        capacity (dict): output from estimate_capacity_no_buffer()
        unit (str): unit label for display (default: "bits")
    
    returns:
        str: formatted report string
    """
    lines = [
        "link capacity estimation (no buffer)",
        "-" * 40
    ]
    
    for link_name in sorted(capacity.keys()):
        value = capacity[link_name]
        
        # format with appropriate unit scaling
        if value >= 1e9:
            formatted = f"{value / 1e9:.2f} Gbps"
        elif value >= 1e6:
            formatted = f"{value / 1e6:.2f} Mbps"
        elif value >= 1e3:
            formatted = f"{value / 1e3:.2f} Kbps"
        else:
            formatted = f"{value:.0f} {unit}"
        
        lines.append(f"  {link_name}: {formatted}")
    
    lines.append("-" * 40)
    
    return "\n".join(lines)


def capacity_to_gbps(capacity: dict) -> dict:
    """
    convert capacity values from bits to gbps.
    
    args:
        capacity (dict): capacity in bits per slot
    
    returns:
        dict: capacity in gbps (bits per second, assuming 500us slot)
    
    note:
        slot duration = 500 microseconds = 0.0005 seconds
        data rate (bps) = bits per slot / slot duration
        gbps = bps / 1e9
    """
    slot_duration_seconds = 500e-6  # 500 microseconds
    
    capacity_gbps = {}
    for link_name, bits_per_slot in capacity.items():
        # convert bits per slot to bits per second
        bps = bits_per_slot / slot_duration_seconds
        # convert to gbps
        gbps = bps / 1e9
        capacity_gbps[link_name] = round(gbps, 2)
    
    return capacity_gbps


# =============================================================================
# buffer-aware capacity estimation
# =============================================================================

# timing constants
SLOT_DURATION_SECONDS = 500e-6      # 500 microseconds
SYMBOLS_PER_SLOT = 14
SYMBOL_DURATION_SECONDS = SLOT_DURATION_SECONDS / SYMBOLS_PER_SLOT  # ~35.7 µs


def simulate_buffer(traffic_per_slot: list, capacity_bits_per_slot: float, 
                    buffer_symbols: int = 4) -> dict:
    """
    simulate buffer behavior for a given capacity.
    
    models a fifo buffer that absorbs traffic bursts. when incoming
    traffic exceeds link capacity, excess is queued. when the buffer
    overflows, packets are lost.
    
    args:
        traffic_per_slot (list): traffic in bits for each slot
        capacity_bits_per_slot (float): link capacity in bits per slot
        buffer_symbols (int): buffer size in symbols (default: 4)
    
    returns:
        dict: simulation results including:
            - total_slots: number of slots simulated
            - loss_slots: slots where buffer overflow occurred
            - loss_ratio: loss_slots / total_slots
            - max_buffer_usage: peak buffer occupancy in bits
    """
    # calculate buffer size in bits
    # buffer_time = buffer_symbols * symbol_duration
    # buffer can hold: capacity_bps * buffer_time bits
    # capacity_bps = capacity_bits_per_slot / slot_duration
    # buffer_bits = capacity_bps * buffer_time
    #             = (capacity_bits_per_slot / slot_duration) * (buffer_symbols * symbol_duration)
    #             = capacity_bits_per_slot * (buffer_symbols / symbols_per_slot)
    buffer_size_bits = capacity_bits_per_slot * (buffer_symbols / SYMBOLS_PER_SLOT)
    
    # simulation state
    buffer_occupancy = 0.0  # current bits in buffer
    loss_slots = 0          # count of slots with overflow
    max_buffer_usage = 0.0  # peak buffer occupancy
    
    for slot_traffic in traffic_per_slot:
        # step 1: traffic arrives
        total_bits = buffer_occupancy + slot_traffic
        
        # step 2: link transmits up to capacity
        transmitted = min(total_bits, capacity_bits_per_slot)
        remaining = total_bits - transmitted
        
        # step 3: check buffer overflow
        if remaining > buffer_size_bits:
            # overflow: excess beyond buffer is lost
            loss_slots += 1
            buffer_occupancy = buffer_size_bits
        else:
            buffer_occupancy = remaining
        
        # track peak buffer usage
        max_buffer_usage = max(max_buffer_usage, buffer_occupancy)
    
    total_slots = len(traffic_per_slot)
    
    return {
        "total_slots": total_slots,
        "loss_slots": loss_slots,
        "loss_ratio": loss_slots / total_slots if total_slots > 0 else 0.0,
        "max_buffer_usage": max_buffer_usage,
        "buffer_size_bits": buffer_size_bits
    }


def find_minimum_capacity(traffic_per_slot: list, buffer_symbols: int = 4,
                          loss_tolerance: float = 0.01) -> float:
    """
    find minimum capacity that satisfies loss tolerance using binary search.
    
    args:
        traffic_per_slot (list): traffic in bits for each slot
        buffer_symbols (int): buffer size in symbols
        loss_tolerance (float): maximum allowed loss ratio (default: 0.01 = 1%)
    
    returns:
        float: minimum required capacity in bits per slot
    """
    if not traffic_per_slot:
        return 0.0
    
    # binary search bounds
    # lower bound: mean traffic (theoretical minimum)
    # upper bound: max traffic (no-buffer case, guaranteed zero loss)
    min_capacity = sum(traffic_per_slot) / len(traffic_per_slot)
    max_capacity = max(traffic_per_slot)
    
    # if max traffic already meets tolerance, that's our upper bound
    # if mean traffic is close to max, start from a lower point
    min_capacity = max(min_capacity * 0.5, 1.0)
    
    # binary search precision (0.1% of max)
    precision = max_capacity * 0.001
    
    # binary search for minimum capacity
    iterations = 0
    max_iterations = 100  # safety limit
    
    while (max_capacity - min_capacity) > precision and iterations < max_iterations:
        mid_capacity = (min_capacity + max_capacity) / 2
        
        result = simulate_buffer(traffic_per_slot, mid_capacity, buffer_symbols)
        
        if result["loss_ratio"] <= loss_tolerance:
            # this capacity works, try lower
            max_capacity = mid_capacity
        else:
            # this capacity has too much loss, need higher
            min_capacity = mid_capacity
        
        iterations += 1
    
    # return upper bound (guaranteed to satisfy tolerance)
    return max_capacity


def estimate_capacity_with_buffer(link_traffic_df: pd.DataFrame, 
                                   buffer_symbols: int = 4,
                                   loss_tolerance: float = 0.01) -> dict:
    """
    estimate required link capacity with buffering.
    
    in the buffered scenario, a small buffer (4 symbols = 143 µs) can
    absorb traffic bursts, allowing lower capacity than peak traffic.
    we find the minimum capacity such that packet loss occurs in at
    most loss_tolerance fraction of slots.
    
    algorithm:
        1. for each link, extract traffic time series
        2. use binary search to find minimum capacity
        3. simulate buffer behavior at each candidate capacity
        4. return capacity where loss_ratio <= loss_tolerance
    
    args:
        link_traffic_df (pd.DataFrame): aggregated traffic with columns:
            - slot_id: slot index
            - Link_X_bits: traffic per link in bits
        buffer_symbols (int): buffer size in symbols (default: 4 = 143 µs)
        loss_tolerance (float): max allowed loss ratio (default: 0.01 = 1%)
    
    returns:
        dict: mapping of link name to required capacity in bits per slot
            e.g., {"Link_1": 45000000, "Link_2": 38000000}
    
    example:
        >>> capacity = estimate_capacity_with_buffer(df, buffer_symbols=4, loss_tolerance=0.01)
        >>> print(capacity)
        {'Link_1': 45000000.0, 'Link_2': 38000000.0}
    """
    
    # identify link columns
    link_columns = [col for col in link_traffic_df.columns if col.endswith("_bits")]
    
    if not link_columns:
        raise ValueError(
            "no link columns found. expected columns ending with '_bits'. "
            f"found columns: {link_traffic_df.columns.tolist()}"
        )
    
    # sort by slot_id to ensure correct time ordering
    df_sorted = link_traffic_df.sort_values("slot_id")
    
    # estimate capacity for each link
    capacity = {}
    for col in link_columns:
        link_name = col.replace("_bits", "")
        
        # extract traffic time series
        traffic_series = df_sorted[col].tolist()
        
        # find minimum capacity
        min_capacity = find_minimum_capacity(
            traffic_series, 
            buffer_symbols=buffer_symbols,
            loss_tolerance=loss_tolerance
        )
        
        capacity[link_name] = min_capacity
    
    return capacity


def compare_capacity_estimates(no_buffer: dict, with_buffer: dict) -> dict:
    """
    compare no-buffer and with-buffer capacity estimates.
    
    args:
        no_buffer (dict): capacity estimates without buffer
        with_buffer (dict): capacity estimates with buffer
    
    returns:
        dict: comparison showing reduction achieved by buffering
    """
    comparison = {}
    
    for link_name in no_buffer.keys():
        nb = no_buffer.get(link_name, 0)
        wb = with_buffer.get(link_name, 0)
        
        reduction = nb - wb
        reduction_pct = (reduction / nb * 100) if nb > 0 else 0
        
        comparison[link_name] = {
            "no_buffer_bits": nb,
            "with_buffer_bits": wb,
            "reduction_bits": reduction,
            "reduction_percent": round(reduction_pct, 2)
        }
    
    return comparison

"""
link aggregation module
=======================
aggregates slot-level cell traffic into link-level traffic.

this module combines traffic from cells that share the same fronthaul link,
producing aggregated traffic per slot for each link. this is required for
link capacity estimation.

workflow:
    1. map cells to links using inferred topology
    2. sum traffic from all cells on the same link per slot
    3. output one row per slot with columns for each link

author: nokia hackathon team
date: january 2026
"""

import pandas as pd


def aggregate_slot_traffic_by_link(slot_df: pd.DataFrame, topology: dict) -> pd.DataFrame:
    """
    aggregate slot-level cell traffic by link.
    
    combines traffic from all cells belonging to the same link for each slot.
    produces a wide-format dataframe with one column per link.
    
    args:
        slot_df (pd.DataFrame): slot-level data with columns:
            - slot_id: slot index
            - cell_id: cell identifier
            - slot_throughput_bits: traffic in bits
        topology (dict): mapping of cell_id to link label
            e.g., {"cell_1": "Link_1", "cell_2": "Link_1", "cell_3": "Link_2"}
    
    returns:
        pd.DataFrame: aggregated traffic with columns:
            - slot_id: slot index
            - Link_1_bits, Link_2_bits, ...: traffic per link in bits
    
    raises:
        KeyError: if required columns are missing from slot_df
    
    example:
        >>> slot_df = pd.DataFrame({
        ...     'slot_id': [0, 0, 0, 1, 1, 1],
        ...     'cell_id': ['cell_1', 'cell_2', 'cell_3', 'cell_1', 'cell_2', 'cell_3'],
        ...     'slot_throughput_bits': [1000, 2000, 1500, 1100, 2100, 1600]
        ... })
        >>> topology = {'cell_1': 'Link_1', 'cell_2': 'Link_1', 'cell_3': 'Link_2'}
        >>> result = aggregate_slot_traffic_by_link(slot_df, topology)
        >>> print(result)
           slot_id  Link_1_bits  Link_2_bits
        0        0         3000         1500
        1        1         3200         1600
    """
    
    # validate required columns
    required_columns = ["slot_id", "cell_id", "slot_throughput_bits"]
    missing = [col for col in required_columns if col not in slot_df.columns]
    if missing:
        raise KeyError(
            f"missing required columns: {missing}. "
            f"expected: {required_columns}"
        )
    
    # work on a copy
    data = slot_df.copy()
    
    # map cell_id to link using topology
    # cells not in topology are assigned to "Unknown_Link"
    data["link_id"] = data["cell_id"].map(topology).fillna("Unknown_Link")
    
    # aggregate: sum traffic per slot per link
    link_traffic = (
        data.groupby(["slot_id", "link_id"], as_index=False)
        .agg(link_throughput_bits=("slot_throughput_bits", "sum"))
    )
    
    # pivot to wide format: one column per link
    pivot_df = link_traffic.pivot(
        index="slot_id",
        columns="link_id",
        values="link_throughput_bits"
    ).fillna(0).reset_index()
    
    # rename columns to include _bits suffix
    rename_map = {
        col: f"{col}_bits" for col in pivot_df.columns if col != "slot_id"
    }
    pivot_df = pivot_df.rename(columns=rename_map)
    
    # sort columns: slot_id first, then links in order
    link_columns = sorted([col for col in pivot_df.columns if col != "slot_id"])
    pivot_df = pivot_df[["slot_id"] + link_columns]
    
    # ensure slot_id is integer
    pivot_df["slot_id"] = pivot_df["slot_id"].astype(int)
    
    return pivot_df


def get_link_traffic_summary(link_traffic_df: pd.DataFrame) -> dict:
    """
    get summary statistics for aggregated link traffic.
    
    args:
        link_traffic_df (pd.DataFrame): output from aggregate_slot_traffic_by_link()
    
    returns:
        dict: summary statistics per link including:
            - total_slots: number of slots
            - per-link: min, max, mean, total traffic in bits
    """
    link_columns = [col for col in link_traffic_df.columns if col.endswith("_bits")]
    
    summary = {
        "total_slots": len(link_traffic_df),
        "links": {}
    }
    
    for col in link_columns:
        link_name = col.replace("_bits", "")
        summary["links"][link_name] = {
            "min_bits": float(link_traffic_df[col].min()),
            "max_bits": float(link_traffic_df[col].max()),
            "mean_bits": float(link_traffic_df[col].mean()),
            "total_bits": float(link_traffic_df[col].sum())
        }
    
    return summary


def get_link_columns(link_traffic_df: pd.DataFrame) -> list:
    """
    get list of link column names from aggregated traffic dataframe.
    
    args:
        link_traffic_df (pd.DataFrame): output from aggregate_slot_traffic_by_link()
    
    returns:
        list: column names for link traffic (e.g., ['Link_1_bits', 'Link_2_bits'])
    """
    return [col for col in link_traffic_df.columns if col.endswith("_bits")]

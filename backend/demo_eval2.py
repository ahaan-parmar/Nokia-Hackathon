"""
evaluation 2 demo script
5g fronthaul topology inference + capacity estimation - nokia hackathon

this script demonstrates the complete pipeline:
- topology identification (from eval-1)
- slot-level traffic conversion
- link traffic aggregation
- capacity estimation (no buffer and with buffer)

run: python demo_eval2.py
"""

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from services.data_loader import load_data
from services.congestion import detect_congestion
from services.correlation import compute_congestion_correlation
from services.topology import infer_topology
from services.raw_data_parser import load_all_throughput_indexed
from services.slot_conversion import convert_symbols_to_slots
from services.link_aggregation import aggregate_slot_traffic_by_link, get_link_traffic_summary
from services.capacity_estimation import (
    estimate_capacity_no_buffer,
    estimate_capacity_with_buffer,
    capacity_to_gbps,
    compare_capacity_estimates
)


def print_header(title):
    print("\n" + "=" * 70)
    print(f"  {title}")
    print("=" * 70)


def phase1_topology_inference():
    """
    phase 1: topology identification
    reuses eval-1 logic to get cell -> link mapping
    """
    print_header("phase 1: topology identification")
    
    print("\n[1] loading packet stats data...")
    df = load_data("data/raw")
    print(f"    loaded {len(df):,} rows from {df['cell_id'].nunique()} cells")
    
    print("[2] detecting congestion events...")
    df_cong = detect_congestion(df)
    congestion_count = df_cong["is_congested"].sum()
    print(f"    found {congestion_count:,} congestion events")
    
    print("[3] computing correlation matrix...")
    correlation_matrix = compute_congestion_correlation(df_cong)
    
    print("[4] inferring topology...")
    topology = infer_topology(correlation_matrix)
    num_links = len(set(topology.values()))
    print(f"    assigned {len(topology)} cells to {num_links} links")
    
    # display topology
    links = {}
    for cell, link in topology.items():
        if link not in links:
            links[link] = []
        links[link].append(cell)
    
    print("\n    inferred topology:")
    for link in sorted(links.keys()):
        cells = sorted(links[link], key=lambda x: int(x.split('_')[1]))
        print(f"      {link.lower()}: {', '.join(cells)}")
    
    return topology


def phase2_traffic_aggregation(topology):
    """
    phase 2: slot-level traffic aggregation per link
    """
    print_header("phase 2: traffic aggregation")
    
    print("\n[1] loading throughput data (symbol level)...")
    symbol_df = load_all_throughput_indexed("data/raw")
    num_symbols = len(symbol_df)
    num_cells = symbol_df["cell_id"].nunique()
    print(f"    loaded {num_symbols:,} symbols from {num_cells} cells")
    
    print("[2] converting symbols to slots (14 symbols = 1 slot)...")
    slot_df = convert_symbols_to_slots(symbol_df)
    num_slots = slot_df["slot_id"].nunique()
    print(f"    created {num_slots:,} slots per cell")
    print(f"    total slot records: {len(slot_df):,}")
    
    print("[3] aggregating traffic by link...")
    link_traffic = aggregate_slot_traffic_by_link(slot_df, topology)
    link_columns = [col for col in link_traffic.columns if col.endswith("_bits")]
    print(f"    aggregated into {len(link_columns)} links")
    print(f"    total slots: {len(link_traffic):,}")
    
    # summary statistics
    summary = get_link_traffic_summary(link_traffic)
    print("\n    traffic summary (bits per slot):")
    for link_name, stats in sorted(summary["links"].items()):
        max_gbps = (stats["max_bits"] / 500e-6) / 1e9
        mean_gbps = (stats["mean_bits"] / 500e-6) / 1e9
        print(f"      {link_name}: max={max_gbps:.2f} gbps, mean={mean_gbps:.2f} gbps")
    
    return link_traffic


def phase3_capacity_estimation(link_traffic):
    """
    phase 3: capacity estimation (no buffer and with buffer)
    """
    print_header("phase 3: capacity estimation")
    
    # no buffer estimation
    print("\n[1] estimating capacity (no buffer)...")
    print("    requirement: handle peak traffic with zero loss")
    capacity_no_buffer = estimate_capacity_no_buffer(link_traffic)
    capacity_no_buffer_gbps = capacity_to_gbps(capacity_no_buffer)
    
    print("\n    results (no buffer):")
    for link in sorted(capacity_no_buffer_gbps.keys()):
        print(f"      {link}: {capacity_no_buffer_gbps[link]:.2f} gbps")
    
    # with buffer estimation
    print("\n[2] estimating capacity (with buffer)...")
    print("    buffer: 4 symbols = 143 microseconds")
    print("    loss tolerance: 1% of slots")
    capacity_with_buffer = estimate_capacity_with_buffer(
        link_traffic, 
        buffer_symbols=4, 
        loss_tolerance=0.01
    )
    capacity_with_buffer_gbps = capacity_to_gbps(capacity_with_buffer)
    
    print("\n    results (with buffer):")
    for link in sorted(capacity_with_buffer_gbps.keys()):
        print(f"      {link}: {capacity_with_buffer_gbps[link]:.2f} gbps")
    
    # comparison
    print("\n[3] capacity reduction from buffering:")
    comparison = compare_capacity_estimates(capacity_no_buffer, capacity_with_buffer)
    for link in sorted(comparison.keys()):
        stats = comparison[link]
        print(f"      {link}: {stats['reduction_percent']:.1f}% reduction")
    
    return {
        "no_buffer": capacity_no_buffer,
        "no_buffer_gbps": capacity_no_buffer_gbps,
        "with_buffer": capacity_with_buffer,
        "with_buffer_gbps": capacity_with_buffer_gbps,
        "comparison": comparison
    }


def export_results(topology, capacity_results):
    """
    export all results to json
    """
    print_header("exporting results")
    
    export_data = {
        "topology": topology,
        "capacity": {
            "no_buffer_gbps": capacity_results["no_buffer_gbps"],
            "with_buffer_gbps": capacity_results["with_buffer_gbps"],
            "comparison": capacity_results["comparison"]
        },
        "parameters": {
            "buffer_symbols": 4,
            "buffer_time_us": 143,
            "loss_tolerance": 0.01,
            "slot_duration_us": 500,
            "symbols_per_slot": 14
        }
    }
    
    output_path = "data/eval2_results.json"
    with open(output_path, "w") as f:
        json.dump(export_data, f, indent=2)
    
    print(f"\nresults exported to: {output_path}")


def main():
    print("\n" + "=" * 70)
    print("  nokia hackathon - evaluation 2 demo")
    print("  5g fronthaul topology + capacity estimation")
    print("=" * 70)
    
    # phase 1: topology
    topology = phase1_topology_inference()
    
    # phase 2: traffic aggregation
    link_traffic = phase2_traffic_aggregation(topology)
    
    # phase 3: capacity estimation
    capacity_results = phase3_capacity_estimation(link_traffic)
    
    # export
    export_results(topology, capacity_results)
    
    # final summary
    print_header("evaluation 2 complete")
    print("""
  phase 1 (topology):     24 cells -> inferred links
  phase 2 (aggregation):  symbol -> slot -> link traffic
  phase 3 (capacity):     no-buffer and with-buffer estimates
    
  results saved to:       data/eval2_results.json
    """)


if __name__ == "__main__":
    main()

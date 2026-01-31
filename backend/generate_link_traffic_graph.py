"""
Generate Link Traffic Graph (Figure 3 style)
=============================================
Creates a time series graph showing data rate per slot for
aggregated traffic of cells on Links 1, 2, and 3.

Output: PNG graph similar to Figure 3 from the problem statement
"""

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from services.data_loader import load_data
from services.congestion import detect_congestion
from services.correlation import compute_congestion_correlation
from services.topology import infer_topology
from services.raw_data_parser import load_all_throughput_indexed
from services.slot_conversion import convert_symbols_to_slots
from services.link_aggregation import aggregate_slot_traffic_by_link

# Constants
SLOT_DURATION_SECONDS = 500e-6  # 500 microseconds
DATA_PATH = "data/raw"


def generate_link_traffic_graph(link_ids=[1, 2, 3], duration_seconds=60, output_file="link_traffic_graph.png"):
    """
    Generate a graph showing data rate per slot for specified links.
    
    Args:
        link_ids: List of link IDs to plot (default: [1, 2, 3])
        duration_seconds: Time window in seconds (default: 60)
        output_file: Output PNG filename
    """
    print("=" * 60)
    print("Link Traffic Graph Generator")
    print("=" * 60)
    
    # Step 1: Load and process data
    print("\n[1/5] Loading packet stats for topology inference...")
    df = load_data(DATA_PATH)
    df_with_congestion = detect_congestion(df)
    correlation_matrix = compute_congestion_correlation(df_with_congestion)
    topology = infer_topology(correlation_matrix)
    print(f"       Inferred {len(set(topology.values()))} links from {len(topology)} cells")
    
    # Step 2: Load throughput data
    print("\n[2/5] Loading throughput data (this may take a while)...")
    throughput_df = load_all_throughput_indexed(DATA_PATH)
    total_symbols = len(throughput_df)
    print(f"       Loaded {total_symbols:,} symbols")
    
    # Step 3: Convert to slots
    print("\n[3/5] Converting symbols to slots...")
    slot_df = convert_symbols_to_slots(throughput_df)
    total_slots = slot_df['slot_id'].nunique()
    print(f"       Created {total_slots:,} slots")
    
    # Step 4: Aggregate by link
    print("\n[4/5] Aggregating traffic by link...")
    link_traffic_df = aggregate_slot_traffic_by_link(slot_df, topology)
    
    # Calculate time for each slot
    link_traffic_df['time_seconds'] = link_traffic_df['slot_id'] * SLOT_DURATION_SECONDS
    
    # Filter to requested duration
    max_time = duration_seconds
    filtered_df = link_traffic_df[link_traffic_df['time_seconds'] <= max_time].copy()
    
    # Step 5: Generate plots
    print(f"\n[5/5] Generating graphs for Links {link_ids}...")
    
    for link_id in link_ids:
        link_name = f"Link_{link_id}"
        col_name = f"{link_name}_bits"
        
        if col_name not in filtered_df.columns:
            print(f"       Warning: {link_name} not found in data, skipping...")
            continue
        
        # Get data for this link
        time_data = filtered_df['time_seconds'].values
        bits_data = filtered_df[col_name].values
        
        # Convert bits per slot to Gbps
        # Gbps = (bits per slot) / (slot duration in seconds) / 1e9
        gbps_data = bits_data / SLOT_DURATION_SECONDS / 1e9
        
        # Calculate statistics
        avg_gbps = np.mean(gbps_data)
        peak_gbps = np.max(gbps_data)
        
        # Create figure
        fig, ax = plt.subplots(figsize=(12, 6))
        
        # Plot traffic data (purple bars like in Figure 3)
        ax.fill_between(time_data, 0, gbps_data, color='#9B59B6', alpha=0.8, linewidth=0.5)
        
        # Plot average data rate (green dashed line)
        ax.axhline(y=avg_gbps, color='green', linestyle='--', linewidth=2, 
                   label=f'Average data rate ({avg_gbps:.2f} Gbps)')
        
        # Plot required FH link capacity (red dashed line) - peak capacity
        ax.axhline(y=peak_gbps, color='red', linestyle='--', linewidth=2,
                   label=f'Required FH link capacity ({peak_gbps:.2f} Gbps)')
        
        # Formatting
        ax.set_xlabel('Time [s]', fontsize=12)
        ax.set_ylabel('Data rate [Gbps]', fontsize=12)
        ax.set_title(f'{link_name} - Aggregated Traffic per Slot', fontsize=14)
        ax.set_xlim(0, max_time)
        ax.set_ylim(0, max(peak_gbps * 1.15, 30))  # Add 15% headroom
        ax.grid(True, alpha=0.3)
        ax.legend(loc='upper right')
        
        # Add annotations
        ax.annotate('Required FH link capacity', 
                    xy=(5, peak_gbps), 
                    xytext=(5, peak_gbps + 2),
                    fontsize=10, color='red',
                    arrowprops=dict(arrowstyle='->', color='red'))
        
        ax.annotate('Average\ndata rate', 
                    xy=(3, avg_gbps), 
                    xytext=(0.5, avg_gbps - 3),
                    fontsize=10, color='green')
        
        # Save figure
        filename = f"link_{link_id}_traffic_graph.png"
        plt.tight_layout()
        plt.savefig(filename, dpi=150, bbox_inches='tight')
        plt.close()
        
        print(f"       Saved: {filename}")
        print(f"         - Average: {avg_gbps:.2f} Gbps")
        print(f"         - Peak:    {peak_gbps:.2f} Gbps")
    
    print("\n" + "=" * 60)
    print("Graph generation complete!")
    print("=" * 60)


if __name__ == "__main__":
    generate_link_traffic_graph(link_ids=[1, 2, 3], duration_seconds=60)

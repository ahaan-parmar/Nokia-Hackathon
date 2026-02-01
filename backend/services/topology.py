"""
Topology Inference Module
=========================
Infers shared link assignments from cell correlation data.

This module groups cells into shared Ethernet links based on their
congestion correlation. Cells with high correlation are likely sharing
the same physical link and are grouped together.

Algorithm:
    1. Build a graph where cells are nodes
    2. Add edges between cells with correlation >= threshold
    3. Find connected components (cells reachable through high-correlation edges)
    4. Assign each component a unique link label
"""


def infer_topology(correlation_matrix: dict, threshold: float = 0.7) -> dict:
    """
    Infer shared link topology from cell correlation data.
    
    Groups cells into shared links based on congestion correlation.
    Cells with correlation >= threshold are considered to share a link.
    Uses connected components to find all cells that are transitively
    correlated (if A correlates with B, and B with C, then A, B, C share a link).
    
    Args:
        correlation_matrix (dict): Nested dictionary of correlation values.
            Structure: {cell_id: {other_cell_id: correlation_value, ...}, ...}
        threshold (float): Minimum correlation to consider cells as sharing
            a link. Default is 0.7 (70% correlation).
    
    Returns:
        dict: Mapping of cell_id to link label.
            Structure: {"cell_1": "Link_1", "cell_2": "Link_1", "cell_3": "Link_2"}
    
    Example:
        >>> correlation = {
        ...     "cell_1": {"cell_2": 0.9, "cell_3": 0.1},
        ...     "cell_2": {"cell_1": 0.9, "cell_3": 0.2},
        ...     "cell_3": {"cell_1": 0.1, "cell_2": 0.2}
        ... }
        >>> infer_topology(correlation, threshold=0.7)
        {'cell_1': 'Link_1', 'cell_2': 'Link_1', 'cell_3': 'Link_2'}
    """
    
    # Extract all unique cell IDs from the correlation matrix
    all_cells = set(correlation_matrix.keys())
    
    # Also include cells that appear only as targets (defensive)
    for cell_id, correlations in correlation_matrix.items():
        all_cells.update(correlations.keys())
    
    all_cells = list(all_cells)
    
    # Build adjacency list for cells with correlation >= threshold
    # This represents which cells are "connected" via high correlation
    adjacency = {cell: set() for cell in all_cells}
    
    for cell_a, correlations in correlation_matrix.items():
        for cell_b, corr_value in correlations.items():
            if corr_value >= threshold:
                # Add bidirectional edge (A connected to B means B connected to A)
                adjacency[cell_a].add(cell_b)
                adjacency[cell_b].add(cell_a)
    
    # Find connected components using BFS
    # Each component represents cells sharing the same link
    visited = set()
    components = []
    
    for cell in all_cells:
        if cell in visited:
            continue
        
        # BFS to find all cells in this component
        component = []
        queue = [cell]
        
        while queue:
            current = queue.pop(0)
            if current in visited:
                continue
            
            visited.add(current)
            component.append(current)
            
            # Add unvisited neighbors to queue
            for neighbor in adjacency[current]:
                if neighbor not in visited:
                    queue.append(neighbor)
        
        components.append(component)
    
    # Sort components for deterministic output
    # Larger groups first, then alphabetically by first cell
    components.sort(key=lambda c: (-len(c), min(c)))
    
    # Assign link labels to each component
    cell_to_link = {}
    
    for link_index, component in enumerate(components, start=1):
        link_label = f"Link_{link_index}"
        for cell in component:
            cell_to_link[cell] = link_label
    
    return cell_to_link

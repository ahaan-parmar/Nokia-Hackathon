// Network topology data for 24 radio cells across 4 fronthaul links
// Traffic patterns show correlated congestion for cells sharing the same link

export interface CellData {
  cellId: string;
  linkId: number;
  avgTraffic: number; // Gbps
  peakTraffic: number; // Gbps
  packetLossRate: number; // percentage
}

export interface TrafficPoint {
  time: number; // seconds
  traffic: number; // Gbps
  packetLoss: number; // percentage
}

export interface LinkData {
  linkId: number;
  cells: string[];
  color: string;
  avgTraffic: number;
  peakTraffic: number;
  requiredCapacityWithBuffer: number;
  requiredCapacityWithoutBuffer: number;
}

// 24 cells distributed across 4 fronthaul links
export const cellTopology: CellData[] = [
  // Link 1 - 8 cells (congested link)
  { cellId: "Cell-01", linkId: 1, avgTraffic: 1.2, peakTraffic: 2.8, packetLossRate: 0.12 },
  { cellId: "Cell-02", linkId: 1, avgTraffic: 1.4, peakTraffic: 3.1, packetLossRate: 0.15 },
  { cellId: "Cell-03", linkId: 1, avgTraffic: 0.9, peakTraffic: 2.4, packetLossRate: 0.11 },
  { cellId: "Cell-04", linkId: 1, avgTraffic: 1.1, peakTraffic: 2.6, packetLossRate: 0.13 },
  { cellId: "Cell-05", linkId: 1, avgTraffic: 1.3, peakTraffic: 2.9, packetLossRate: 0.14 },
  { cellId: "Cell-06", linkId: 1, avgTraffic: 1.0, peakTraffic: 2.5, packetLossRate: 0.10 },
  { cellId: "Cell-07", linkId: 1, avgTraffic: 1.5, peakTraffic: 3.2, packetLossRate: 0.16 },
  { cellId: "Cell-08", linkId: 1, avgTraffic: 1.1, peakTraffic: 2.7, packetLossRate: 0.12 },
  
  // Link 2 - 6 cells
  { cellId: "Cell-09", linkId: 2, avgTraffic: 1.8, peakTraffic: 3.5, packetLossRate: 0.08 },
  { cellId: "Cell-10", linkId: 2, avgTraffic: 2.0, peakTraffic: 3.8, packetLossRate: 0.09 },
  { cellId: "Cell-11", linkId: 2, avgTraffic: 1.6, peakTraffic: 3.2, packetLossRate: 0.07 },
  { cellId: "Cell-12", linkId: 2, avgTraffic: 1.9, peakTraffic: 3.6, packetLossRate: 0.08 },
  { cellId: "Cell-13", linkId: 2, avgTraffic: 1.7, peakTraffic: 3.4, packetLossRate: 0.07 },
  { cellId: "Cell-14", linkId: 2, avgTraffic: 2.1, peakTraffic: 4.0, packetLossRate: 0.10 },
  
  // Link 3 - 6 cells
  { cellId: "Cell-15", linkId: 3, avgTraffic: 0.8, peakTraffic: 1.8, packetLossRate: 0.04 },
  { cellId: "Cell-16", linkId: 3, avgTraffic: 0.7, peakTraffic: 1.6, packetLossRate: 0.03 },
  { cellId: "Cell-17", linkId: 3, avgTraffic: 0.9, peakTraffic: 2.0, packetLossRate: 0.05 },
  { cellId: "Cell-18", linkId: 3, avgTraffic: 0.6, peakTraffic: 1.4, packetLossRate: 0.03 },
  { cellId: "Cell-19", linkId: 3, avgTraffic: 0.8, peakTraffic: 1.7, packetLossRate: 0.04 },
  { cellId: "Cell-20", linkId: 3, avgTraffic: 0.7, peakTraffic: 1.5, packetLossRate: 0.03 },
  
  // Link 4 - 4 cells
  { cellId: "Cell-21", linkId: 4, avgTraffic: 2.2, peakTraffic: 4.2, packetLossRate: 0.06 },
  { cellId: "Cell-22", linkId: 4, avgTraffic: 2.4, peakTraffic: 4.5, packetLossRate: 0.07 },
  { cellId: "Cell-23", linkId: 4, avgTraffic: 2.0, peakTraffic: 3.9, packetLossRate: 0.05 },
  { cellId: "Cell-24", linkId: 4, avgTraffic: 2.3, peakTraffic: 4.3, packetLossRate: 0.06 },
];

export const linkColors: Record<number, string> = {
  1: "hsl(var(--link-1))",
  2: "hsl(var(--link-2))",
  3: "hsl(var(--link-3))",
  4: "hsl(var(--link-4))",
};

export const linkColorClasses: Record<number, { text: string; bg: string; border: string }> = {
  1: { text: "text-link-1", bg: "bg-link-1", border: "border-link-1" },
  2: { text: "text-link-2", bg: "bg-link-2", border: "border-link-2" },
  3: { text: "text-link-3", bg: "bg-link-3", border: "border-link-3" },
  4: { text: "text-link-4", bg: "bg-link-4", border: "border-link-4" },
};

// Generate correlated traffic data for cells on the same link
export function generateTrafficData(linkId: number, duration: number = 300): TrafficPoint[] {
  const points: TrafficPoint[] = [];
  const baseNoise = Math.random() * 0.5;
  
  // Different patterns for different links
  const patterns: Record<number, { base: number; amplitude: number; congestionPeriods: number[] }> = {
    1: { base: 9.5, amplitude: 4.5, congestionPeriods: [60, 150, 240] }, // Congested
    2: { base: 11.1, amplitude: 3.2, congestionPeriods: [100, 200] },
    3: { base: 4.5, amplitude: 1.8, congestionPeriods: [] }, // Low traffic
    4: { base: 8.9, amplitude: 3.8, congestionPeriods: [80, 180, 260] },
  };
  
  const pattern = patterns[linkId] || patterns[1];
  
  for (let t = 0; t <= duration; t += 5) {
    // Base sinusoidal pattern
    let traffic = pattern.base + pattern.amplitude * Math.sin((t / 60) * Math.PI);
    
    // Add congestion spikes
    for (const congestionTime of pattern.congestionPeriods) {
      const distance = Math.abs(t - congestionTime);
      if (distance < 30) {
        traffic += (3 - distance / 10) * (1 - distance / 30);
      }
    }
    
    // Add noise
    traffic += (Math.random() - 0.5) * 1.5 + baseNoise;
    traffic = Math.max(0, traffic);
    
    // Packet loss correlates with high traffic
    const packetLoss = traffic > pattern.base + pattern.amplitude * 0.7 
      ? 0.05 + Math.random() * 0.15 
      : Math.random() * 0.02;
    
    points.push({
      time: t,
      traffic: Math.round(traffic * 100) / 100,
      packetLoss: Math.round(packetLoss * 10000) / 100,
    });
  }
  
  return points;
}

// Calculate link summary data
export function calculateLinkData(): LinkData[] {
  const links: Map<number, CellData[]> = new Map();
  
  cellTopology.forEach(cell => {
    if (!links.has(cell.linkId)) {
      links.set(cell.linkId, []);
    }
    links.get(cell.linkId)!.push(cell);
  });
  
  return Array.from(links.entries()).map(([linkId, cells]) => {
    const avgTraffic = cells.reduce((sum, c) => sum + c.avgTraffic, 0);
    const peakTraffic = cells.reduce((sum, c) => sum + c.peakTraffic, 0);
    
    // Buffer reduces required capacity by ~15-20% by smoothing peaks
    const bufferReduction = 0.18;
    const requiredCapacityWithoutBuffer = peakTraffic * 1.2; // 20% headroom
    const requiredCapacityWithBuffer = peakTraffic * (1.2 - bufferReduction);
    
    return {
      linkId,
      cells: cells.map(c => c.cellId),
      color: linkColors[linkId],
      avgTraffic: Math.round(avgTraffic * 100) / 100,
      peakTraffic: Math.round(peakTraffic * 100) / 100,
      requiredCapacityWithBuffer: Math.round(requiredCapacityWithBuffer * 100) / 100,
      requiredCapacityWithoutBuffer: Math.round(requiredCapacityWithoutBuffer * 100) / 100,
    };
  });
}

// Generate correlation matrix for cells
export function generateCorrelationMatrix(): { cells: string[]; matrix: number[][] } {
  const cells = cellTopology.map(c => c.cellId);
  const matrix: number[][] = [];
  
  for (let i = 0; i < cells.length; i++) {
    const row: number[] = [];
    for (let j = 0; j < cells.length; j++) {
      if (i === j) {
        row.push(1);
      } else if (cellTopology[i].linkId === cellTopology[j].linkId) {
        // High correlation for same link (0.7-0.95)
        row.push(0.7 + Math.random() * 0.25);
      } else {
        // Low correlation for different links (0.1-0.3)
        row.push(0.1 + Math.random() * 0.2);
      }
    }
    matrix.push(row);
  }
  
  return { cells, matrix };
}

export const datasets = [
  { id: "dataset-1", name: "Peak Hour Traffic (12:00-13:00)", description: "High congestion period" },
  { id: "dataset-2", name: "Evening Traffic (18:00-19:00)", description: "Moderate congestion" },
  { id: "dataset-3", name: "Night Traffic (02:00-03:00)", description: "Low traffic baseline" },
];

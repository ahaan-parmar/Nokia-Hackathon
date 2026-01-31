// Network topology data for 24 radio cells across 9 fronthaul links
// Inferred from traffic correlation analysis

export interface CellData {
  cellId: string;
  linkId: number;
  linkName: string;
  avgTraffic: number; // Gbps
  peakTraffic: number; // Gbps
  packetLossRate: number; // percentage
  isolated: boolean;
}

export interface TrafficPoint {
  time: number; // seconds
  traffic: number; // Gbps
  packetLoss: number; // percentage
}

export interface LinkData {
  linkId: number;
  linkName: string;
  cells: string[];
  color: string;
  avgTraffic: number;
  peakTraffic: number;
  requiredCapacityWithBuffer: number;
  requiredCapacityWithoutBuffer: number;
  isolated: boolean;
}

// Inferred topology from dataset analysis
// 24 cells distributed across 9 fronthaul links (5 shared + 4 isolated)
export const cellTopology: CellData[] = [
  // Link 1: cell_1, cell_9, cell_17, cell_22
  { cellId: "cell_1", linkId: 1, linkName: "Link_1", avgTraffic: 1.2, peakTraffic: 2.8, packetLossRate: 0.08, isolated: false },
  { cellId: "cell_9", linkId: 1, linkName: "Link_1", avgTraffic: 1.4, peakTraffic: 3.1, packetLossRate: 0.09, isolated: false },
  { cellId: "cell_17", linkId: 1, linkName: "Link_1", avgTraffic: 1.1, peakTraffic: 2.6, packetLossRate: 0.07, isolated: false },
  { cellId: "cell_22", linkId: 1, linkName: "Link_1", avgTraffic: 1.3, peakTraffic: 2.9, packetLossRate: 0.08, isolated: false },
  
  // Link 2: cell_8, cell_10, cell_18, cell_19
  { cellId: "cell_8", linkId: 2, linkName: "Link_2", avgTraffic: 1.8, peakTraffic: 3.5, packetLossRate: 0.10, isolated: false },
  { cellId: "cell_10", linkId: 2, linkName: "Link_2", avgTraffic: 2.0, peakTraffic: 3.8, packetLossRate: 0.11, isolated: false },
  { cellId: "cell_18", linkId: 2, linkName: "Link_2", avgTraffic: 1.6, peakTraffic: 3.2, packetLossRate: 0.09, isolated: false },
  { cellId: "cell_19", linkId: 2, linkName: "Link_2", avgTraffic: 1.9, peakTraffic: 3.6, packetLossRate: 0.10, isolated: false },
  
  // Link 3: cell_4, cell_5, cell_12, cell_20
  { cellId: "cell_4", linkId: 3, linkName: "Link_3", avgTraffic: 0.9, peakTraffic: 2.0, packetLossRate: 0.05, isolated: false },
  { cellId: "cell_5", linkId: 3, linkName: "Link_3", avgTraffic: 0.8, peakTraffic: 1.8, packetLossRate: 0.04, isolated: false },
  { cellId: "cell_12", linkId: 3, linkName: "Link_3", avgTraffic: 1.0, peakTraffic: 2.2, packetLossRate: 0.06, isolated: false },
  { cellId: "cell_20", linkId: 3, linkName: "Link_3", avgTraffic: 0.7, peakTraffic: 1.6, packetLossRate: 0.04, isolated: false },
  
  // Link 4: cell_7, cell_13, cell_15, cell_16
  { cellId: "cell_7", linkId: 4, linkName: "Link_4", avgTraffic: 1.5, peakTraffic: 3.2, packetLossRate: 0.07, isolated: false },
  { cellId: "cell_13", linkId: 4, linkName: "Link_4", avgTraffic: 1.7, peakTraffic: 3.4, packetLossRate: 0.08, isolated: false },
  { cellId: "cell_15", linkId: 4, linkName: "Link_4", avgTraffic: 1.4, peakTraffic: 3.0, packetLossRate: 0.06, isolated: false },
  { cellId: "cell_16", linkId: 4, linkName: "Link_4", avgTraffic: 1.6, peakTraffic: 3.3, packetLossRate: 0.07, isolated: false },
  
  // Link 5: cell_2, cell_6, cell_23, cell_24
  { cellId: "cell_2", linkId: 5, linkName: "Link_5", avgTraffic: 2.2, peakTraffic: 4.2, packetLossRate: 0.12, isolated: false },
  { cellId: "cell_6", linkId: 5, linkName: "Link_5", avgTraffic: 2.0, peakTraffic: 3.9, packetLossRate: 0.11, isolated: false },
  { cellId: "cell_23", linkId: 5, linkName: "Link_5", avgTraffic: 2.4, peakTraffic: 4.5, packetLossRate: 0.13, isolated: false },
  { cellId: "cell_24", linkId: 5, linkName: "Link_5", avgTraffic: 2.3, peakTraffic: 4.3, packetLossRate: 0.12, isolated: false },
  
  // Isolated cells (each on their own link)
  { cellId: "cell_11", linkId: 6, linkName: "Link_6", avgTraffic: 1.1, peakTraffic: 2.5, packetLossRate: 0.03, isolated: true },
  { cellId: "cell_14", linkId: 7, linkName: "Link_7", avgTraffic: 1.3, peakTraffic: 2.8, packetLossRate: 0.04, isolated: true },
  { cellId: "cell_21", linkId: 8, linkName: "Link_8", avgTraffic: 1.0, peakTraffic: 2.3, packetLossRate: 0.02, isolated: true },
  { cellId: "cell_3", linkId: 9, linkName: "Link_9", avgTraffic: 0.9, peakTraffic: 2.1, packetLossRate: 0.03, isolated: true },
];

// Colors for 9 links
export const linkColors: Record<number, string> = {
  1: "#22d3ee", // cyan
  2: "#c084fc", // purple
  3: "#facc15", // yellow
  4: "#4ade80", // green
  5: "#f87171", // red
  6: "#60a5fa", // blue
  7: "#fb923c", // orange
  8: "#a78bfa", // violet
  9: "#2dd4bf", // teal
};

export const linkColorClasses: Record<number, { text: string; bg: string; border: string }> = {
  1: { text: "text-cyan-400", bg: "bg-cyan-400", border: "border-cyan-400" },
  2: { text: "text-purple-400", bg: "bg-purple-400", border: "border-purple-400" },
  3: { text: "text-yellow-400", bg: "bg-yellow-400", border: "border-yellow-400" },
  4: { text: "text-green-400", bg: "bg-green-400", border: "border-green-400" },
  5: { text: "text-red-400", bg: "bg-red-400", border: "border-red-400" },
  6: { text: "text-blue-400", bg: "bg-blue-400", border: "border-blue-400" },
  7: { text: "text-orange-400", bg: "bg-orange-400", border: "border-orange-400" },
  8: { text: "text-violet-400", bg: "bg-violet-400", border: "border-violet-400" },
  9: { text: "text-teal-400", bg: "bg-teal-400", border: "border-teal-400" },
};

// Generate correlated traffic data for cells on the same link
export function generateTrafficData(linkId: number, duration: number = 300): TrafficPoint[] {
  const points: TrafficPoint[] = [];
  const baseNoise = Math.random() * 0.5;
  
  // Different patterns for different links
  const patterns: Record<number, { base: number; amplitude: number; congestionPeriods: number[] }> = {
    1: { base: 5.0, amplitude: 2.5, congestionPeriods: [60, 150, 240] },
    2: { base: 7.3, amplitude: 3.0, congestionPeriods: [100, 200] },
    3: { base: 3.4, amplitude: 1.5, congestionPeriods: [80] },
    4: { base: 6.2, amplitude: 2.8, congestionPeriods: [120, 220] },
    5: { base: 8.9, amplitude: 3.5, congestionPeriods: [70, 160, 250] },
    6: { base: 1.1, amplitude: 0.8, congestionPeriods: [] },
    7: { base: 1.3, amplitude: 0.9, congestionPeriods: [] },
    8: { base: 1.0, amplitude: 0.7, congestionPeriods: [] },
    9: { base: 0.9, amplitude: 0.6, congestionPeriods: [] },
  };
  
  const pattern = patterns[linkId] || { base: 2.0, amplitude: 1.0, congestionPeriods: [] };
  
  for (let t = 0; t <= duration; t += 5) {
    let traffic = pattern.base + pattern.amplitude * Math.sin((t / 60) * Math.PI);
    
    for (const congestionTime of pattern.congestionPeriods) {
      const distance = Math.abs(t - congestionTime);
      if (distance < 30) {
        traffic += (3 - distance / 10) * (1 - distance / 30);
      }
    }
    
    traffic += (Math.random() - 0.5) * 1.5 + baseNoise;
    traffic = Math.max(0, traffic);
    
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
  
  return Array.from(links.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([linkId, cells]) => {
      const avgTraffic = cells.reduce((sum, c) => sum + c.avgTraffic, 0);
      const peakTraffic = cells.reduce((sum, c) => sum + c.peakTraffic, 0);
      const isolated = cells.length === 1 && cells[0].isolated;
      
      const bufferReduction = 0.18;
      const requiredCapacityWithoutBuffer = peakTraffic * 1.2;
      const requiredCapacityWithBuffer = peakTraffic * (1.2 - bufferReduction);
      
      return {
        linkId,
        linkName: cells[0].linkName,
        cells: cells.map(c => c.cellId),
        color: linkColors[linkId],
        avgTraffic: Math.round(avgTraffic * 100) / 100,
        peakTraffic: Math.round(peakTraffic * 100) / 100,
        requiredCapacityWithBuffer: Math.round(requiredCapacityWithBuffer * 100) / 100,
        requiredCapacityWithoutBuffer: Math.round(requiredCapacityWithoutBuffer * 100) / 100,
        isolated,
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
        row.push(0.7 + Math.random() * 0.25);
      } else {
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

import { useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Checkbox } from "@/components/ui/checkbox";
import { cellTopology, linkColorClasses } from "@/data/networkData";

// Generate per-cell traffic data with correlation for same-link cells
function generateCellTrafficData(cellId: string, duration: number = 300) {
  const cell = cellTopology.find((c) => c.cellId === cellId);
  if (!cell) return [];

  const points: { time: number; throughput: number; packetLoss: number }[] = [];
  const linkId = cell.linkId;

  // Seed based on linkId for correlation
  const linkSeed = linkId * 1000;
  const cellSeed = parseInt(cellId.replace("Cell-", ""));

  for (let t = 0; t <= duration; t += 5) {
    // Base pattern correlated by link
    const linkPhase = (t / 60) * Math.PI + linkSeed * 0.01;
    let throughput =
      cell.avgTraffic +
      (cell.peakTraffic - cell.avgTraffic) * 0.5 * Math.sin(linkPhase);

    // Add congestion spikes at specific times based on link
    const congestionTimes: Record<number, number[]> = {
      1: [60, 150, 240],
      2: [100, 200],
      3: [],
      4: [80, 180, 260],
    };

    for (const ct of congestionTimes[linkId] || []) {
      const dist = Math.abs(t - ct);
      if (dist < 25) {
        throughput += (cell.peakTraffic - cell.avgTraffic) * 0.6 * (1 - dist / 25);
      }
    }

    // Small per-cell variation
    throughput += (Math.sin(t * 0.1 + cellSeed) * 0.1 + Math.random() * 0.05) * cell.avgTraffic;
    throughput = Math.max(0, throughput);

    // Packet loss correlates with high throughput and link congestion
    let packetLoss = cell.packetLossRate * 0.3;
    if (throughput > cell.avgTraffic + (cell.peakTraffic - cell.avgTraffic) * 0.5) {
      packetLoss = cell.packetLossRate * (0.8 + Math.random() * 0.4);
    }

    points.push({
      time: t,
      throughput: Math.round(throughput * 100) / 100,
      packetLoss: Math.round(packetLoss * 10000) / 100,
    });
  }

  return points;
}

const CELL_COLORS = [
  "#22d3ee", // cyan
  "#c084fc", // purple
  "#facc15", // yellow
  "#4ade80", // green
  "#f87171", // red
  "#60a5fa", // blue
  "#fb923c", // orange
  "#a78bfa", // violet
];

interface CellTrafficChartProps {
  mode: "throughput" | "packetLoss";
}

export function CellTrafficChart({ mode }: CellTrafficChartProps) {
  const [selectedCells, setSelectedCells] = useState<string[]>(["Cell-01", "Cell-02", "Cell-09"]);

  const toggleCell = (cellId: string) => {
    setSelectedCells((prev) => {
      if (prev.includes(cellId)) {
        return prev.filter((id) => id !== cellId);
      }
      if (prev.length >= 8) return prev; // Max 8 cells
      return [...prev, cellId];
    });
  };

  const chartData = useMemo(() => {
    if (selectedCells.length === 0) return [];

    const allSeries = selectedCells.map((cellId) => ({
      cellId,
      data: generateCellTrafficData(cellId, 300),
    }));

    // Merge by time
    return allSeries[0].data.map((point, i) => {
      const row: Record<string, number> = { time: point.time };
      allSeries.forEach((series) => {
        row[series.cellId] =
          mode === "throughput"
            ? series.data[i].throughput
            : series.data[i].packetLoss;
      });
      return row;
    });
  }, [selectedCells, mode]);

  // Group cells by link for the selector
  const cellsByLink = useMemo(() => {
    const grouped: Record<number, typeof cellTopology> = {};
    cellTopology.forEach((cell) => {
      if (!grouped[cell.linkId]) grouped[cell.linkId] = [];
      grouped[cell.linkId].push(cell);
    });
    return grouped;
  }, []);

  return (
    <div className="space-y-4">
      {/* Cell selector */}
      <div className="p-4 rounded-lg bg-secondary/30 border border-border">
        <div className="text-xs text-muted-foreground mb-3">
          Select cells to compare (max 8). Cells on the same link show correlated patterns.
        </div>
        <div className="space-y-3">
          {Object.entries(cellsByLink).map(([linkId, cells]) => (
            <div key={linkId} className="flex flex-wrap items-center gap-2">
              <span
                className={`text-xs font-medium w-14 ${
                  linkColorClasses[parseInt(linkId)]?.text || "text-foreground"
                }`}
              >
                Link {linkId}:
              </span>
              {cells.map((cell) => (
                <label
                  key={cell.cellId}
                  className={`flex items-center gap-1.5 text-xs cursor-pointer px-2 py-1 rounded border ${
                    selectedCells.includes(cell.cellId)
                      ? "border-primary/50 bg-primary/10"
                      : "border-transparent hover:bg-secondary/50"
                  }`}
                >
                  <Checkbox
                    checked={selectedCells.includes(cell.cellId)}
                    onCheckedChange={() => toggleCell(cell.cellId)}
                    className="h-3 w-3"
                  />
                  <span className="text-foreground">{cell.cellId.replace("Cell-", "")}</span>
                </label>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Chart */}
      {selectedCells.length === 0 ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
          Select one or more cells above to view {mode === "throughput" ? "throughput" : "packet loss"} over time.
        </div>
      ) : (
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
              <XAxis
                dataKey="time"
                stroke="hsl(var(--muted-foreground))"
                tickFormatter={(v) => `${v}s`}
                fontSize={12}
              />
              <YAxis
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                label={{
                  value: mode === "throughput" ? "Gbps" : "Loss %",
                  angle: -90,
                  position: "insideLeft",
                  style: { fill: "hsl(var(--muted-foreground))" },
                }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  color: "hsl(var(--foreground))",
                }}
                labelFormatter={(label) => `Time: ${label}s`}
                formatter={(value: number, name: string) => [
                  mode === "throughput"
                    ? `${value.toFixed(2)} Gbps`
                    : `${value.toFixed(2)}%`,
                  name,
                ]}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {selectedCells.map((cellId, i) => (
                <Line
                  key={cellId}
                  type="monotone"
                  dataKey={cellId}
                  stroke={CELL_COLORS[i % CELL_COLORS.length]}
                  strokeWidth={1.5}
                  dot={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Observation hint */}
      {selectedCells.length > 1 && (
        <div className="text-xs text-muted-foreground p-3 rounded bg-secondary/20 border border-border">
          <span className="text-foreground font-medium">Observation:</span> Cells on the same 
          fronthaul link (same color group in selector) show synchronized{" "}
          {mode === "throughput" ? "traffic spikes" : "packet loss events"} during congestion periods.
          This correlation is the basis for topology inference.
        </div>
      )}
    </div>
  );
}

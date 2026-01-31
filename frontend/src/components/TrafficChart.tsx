import { useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { generateTrafficData, calculateLinkData } from "@/data/networkData";

const COLOR_MAP: Record<number, string> = {
  1: "#22d3ee",
  2: "#c084fc",
  3: "#facc15",
  4: "#4ade80",
};

interface TrafficChartProps {
  linkIds: number[];
}

export function TrafficChart({ linkIds }: TrafficChartProps) {
  const linkDataList = useMemo(() => calculateLinkData(), []);

  const { chartData, statsPerLink } = useMemo(() => {
    if (linkIds.length === 0) {
      return { chartData: [], statsPerLink: [] };
    }

    const duration = 300;
    const series = linkIds.map((id) => generateTrafficData(id, duration));

    const merged = series[0].map((point, i) => {
      const row: Record<string, number | string> = { time: point.time };
      linkIds.forEach((id, j) => {
        row[`link_${id}`] = series[j][i].traffic;
      });
      return row;
    });

    const stats = linkIds.map((id, j) => {
      const data = series[j];
      const maxTraffic = Math.max(...data.map((d) => d.traffic));
      const avgTraffic =
        data.reduce((sum, d) => sum + d.traffic, 0) / data.length;
      const linkMeta = linkDataList.find((l) => l.linkId === id);
      return {
        linkId: id,
        avgTraffic,
        maxTraffic,
        cells: linkMeta?.cells.length ?? 0,
        requiredCapacity: linkMeta?.requiredCapacityWithBuffer ?? 0,
      };
    });

    return { chartData: merged, statsPerLink: stats };
  }, [linkIds, linkDataList]);

  if (linkIds.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
        Select one or more links above to compare traffic.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats: one row per selected link when multiple, or grid when single */}
      <div
        className={
          linkIds.length === 1
            ? "grid grid-cols-4 gap-4"
            : "flex flex-wrap gap-4"
        }
      >
        {statsPerLink.map((s) => (
          <div
            key={s.linkId}
            className="p-3 rounded-lg bg-secondary/50 flex items-center gap-3 min-w-[140px]"
          >
            <div
              className="w-2 h-8 rounded shrink-0"
              style={{ backgroundColor: COLOR_MAP[s.linkId] ?? COLOR_MAP[1] }}
            />
            <div>
              <div className="text-xs text-muted-foreground">
                Link {s.linkId} · {s.cells} cells
              </div>
              <div className="text-sm font-medium text-foreground">
                Avg {s.avgTraffic.toFixed(2)} Gbps · Peak {s.maxTraffic.toFixed(2)}{" "}
                Gbps
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={chartData}
            margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
          >
            <defs>
              {linkIds.map((id) => {
                const color = COLOR_MAP[id] ?? COLOR_MAP[1];
                return (
                  <linearGradient
                    key={id}
                    id={`gradient-multi-${id}`}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={color} stopOpacity={0} />
                  </linearGradient>
                );
              })}
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="hsl(var(--border))"
              opacity={0.5}
            />
            <XAxis
              dataKey="time"
              stroke="hsl(var(--muted-foreground))"
              tickFormatter={(value) => `${value}s`}
              fontSize={12}
            />
            <YAxis
              stroke="hsl(var(--muted-foreground))"
              tickFormatter={(value) => `${value}`}
              fontSize={12}
              label={{
                value: "Gbps",
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
              formatter={(value: number, name: string) => {
                const id = name.replace("link_", "");
                return [`${Number(value).toFixed(2)} Gbps`, `Link ${id}`];
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: 12 }}
              formatter={(value) => `Link ${value.replace("link_", "")}`}
            />
            {linkIds.map((id) => {
              const color = COLOR_MAP[id] ?? COLOR_MAP[1];
              return (
                <Area
                  key={id}
                  type="monotone"
                  dataKey={`link_${id}`}
                  name={`link_${id}`}
                  stroke={color}
                  strokeWidth={2}
                  fill={`url(#gradient-multi-${id})`}
                />
              );
            })}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

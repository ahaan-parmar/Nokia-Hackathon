import { useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Area, AreaChart } from "recharts";
import { generateTrafficData, linkColors, calculateLinkData } from "@/data/networkData";

interface TrafficChartProps {
  linkId: number;
}

export function TrafficChart({ linkId }: TrafficChartProps) {
  const trafficData = useMemo(() => generateTrafficData(linkId, 300), [linkId]);
  const linkData = useMemo(() => calculateLinkData().find(l => l.linkId === linkId), [linkId]);
  
  const maxTraffic = Math.max(...trafficData.map(d => d.traffic));
  const avgTraffic = trafficData.reduce((sum, d) => sum + d.traffic, 0) / trafficData.length;

  const colorMap: Record<number, string> = {
    1: "#22d3ee", // cyan
    2: "#c084fc", // purple
    3: "#facc15", // yellow
    4: "#4ade80", // green
  };

  const color = colorMap[linkId] || colorMap[1];

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="p-3 rounded-lg bg-secondary/50">
          <div className="text-xs text-muted-foreground">Avg Traffic</div>
          <div className="text-lg font-semibold text-foreground">{avgTraffic.toFixed(2)} Gbps</div>
        </div>
        <div className="p-3 rounded-lg bg-secondary/50">
          <div className="text-xs text-muted-foreground">Peak Traffic</div>
          <div className="text-lg font-semibold text-foreground">{maxTraffic.toFixed(2)} Gbps</div>
        </div>
        <div className="p-3 rounded-lg bg-secondary/50">
          <div className="text-xs text-muted-foreground">Connected Cells</div>
          <div className="text-lg font-semibold text-foreground">{linkData?.cells.length || 0}</div>
        </div>
        <div className="p-3 rounded-lg bg-secondary/50">
          <div className="text-xs text-muted-foreground">Required Capacity</div>
          <div className="text-lg font-semibold text-foreground">{linkData?.requiredCapacityWithBuffer.toFixed(1)} Gbps</div>
        </div>
      </div>

      {/* Chart */}
      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={trafficData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={`gradient-${linkId}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.3}/>
                <stop offset="95%" stopColor={color} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
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
                value: 'Gbps', 
                angle: -90, 
                position: 'insideLeft',
                style: { fill: 'hsl(var(--muted-foreground))' }
              }}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'hsl(var(--popover))', 
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                color: 'hsl(var(--foreground))'
              }}
              formatter={(value: number) => [`${value.toFixed(2)} Gbps`, 'Traffic']}
              labelFormatter={(label) => `Time: ${label}s`}
            />
            <ReferenceLine 
              y={avgTraffic} 
              stroke="hsl(var(--muted-foreground))" 
              strokeDasharray="5 5"
              label={{ 
                value: 'Avg', 
                position: 'right',
                style: { fill: 'hsl(var(--muted-foreground))', fontSize: 10 }
              }}
            />
            <Area 
              type="monotone" 
              dataKey="traffic" 
              stroke={color}
              strokeWidth={2}
              fill={`url(#gradient-${linkId})`}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

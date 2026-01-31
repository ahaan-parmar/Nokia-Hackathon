import { LinkData } from "@/data/networkData";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from "recharts";

interface BufferAnalysisProps {
  linkData: LinkData[];
  withBuffer: boolean;
}

export function BufferAnalysis({ linkData, withBuffer }: BufferAnalysisProps) {
  const comparisonData = linkData.map(link => ({
    name: `Link ${link.linkId}`,
    withBuffer: link.requiredCapacityWithBuffer,
    withoutBuffer: link.requiredCapacityWithoutBuffer,
    savings: link.requiredCapacityWithoutBuffer - link.requiredCapacityWithBuffer,
  }));

  const totalWithBuffer = linkData.reduce((sum, l) => sum + l.requiredCapacityWithBuffer, 0);
  const totalWithoutBuffer = linkData.reduce((sum, l) => sum + l.requiredCapacityWithoutBuffer, 0);
  const totalSavings = totalWithoutBuffer - totalWithBuffer;
  const percentageSavings = ((totalSavings / totalWithoutBuffer) * 100).toFixed(1);

  const colors = {
    withBuffer: "#22d3ee",
    withoutBuffer: "#f87171",
  };

  return (
    <div className="space-y-6">
      {/* Explanation */}
      <div className="p-4 rounded-lg bg-secondary/30 border border-border">
        <h4 className="font-medium text-foreground mb-2">How Buffer Size Affects Capacity</h4>
        <p className="text-sm text-muted-foreground leading-relaxed">
          A 4-symbol buffer smooths traffic peaks by temporarily storing excess data during congestion spikes. 
          This allows the fronthaul link to operate at a lower provisioned capacity while still handling 
          bursty traffic patterns. Without buffering, the link must be provisioned for absolute peak rates, 
          resulting in <span className="text-warning font-medium">15-20% higher capacity requirements</span>.
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid md:grid-cols-4 gap-4">
        <div className="p-4 rounded-lg bg-secondary/50 border border-primary/20">
          <div className="text-xs text-muted-foreground mb-1">Total w/ Buffer</div>
          <div className="text-2xl font-bold text-primary">{totalWithBuffer.toFixed(1)} Gbps</div>
        </div>
        <div className="p-4 rounded-lg bg-secondary/50 border border-destructive/20">
          <div className="text-xs text-muted-foreground mb-1">Total w/o Buffer</div>
          <div className="text-2xl font-bold text-destructive">{totalWithoutBuffer.toFixed(1)} Gbps</div>
        </div>
        <div className="p-4 rounded-lg bg-secondary/50 border border-success/20">
          <div className="text-xs text-muted-foreground mb-1">Capacity Savings</div>
          <div className="text-2xl font-bold text-success">{totalSavings.toFixed(1)} Gbps</div>
        </div>
        <div className="p-4 rounded-lg bg-secondary/50 border border-warning/20">
          <div className="text-xs text-muted-foreground mb-1">Percentage Saved</div>
          <div className="text-2xl font-bold text-warning">{percentageSavings}%</div>
        </div>
      </div>

      {/* Chart */}
      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={comparisonData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
            <XAxis 
              dataKey="name" 
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
            />
            <YAxis 
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
              label={{ 
                value: 'Required Capacity (Gbps)', 
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
              formatter={(value: number, name: string) => [
                `${value.toFixed(2)} Gbps`, 
                name === 'withBuffer' ? 'With Buffer' : 'Without Buffer'
              ]}
            />
            <Legend 
              formatter={(value) => value === 'withBuffer' ? 'With Buffer (4 symbols)' : 'Without Buffer'}
              wrapperStyle={{ color: 'hsl(var(--foreground))' }}
            />
            <Bar dataKey="withBuffer" fill={colors.withBuffer} radius={[4, 4, 0, 0]} />
            <Bar dataKey="withoutBuffer" fill={colors.withoutBuffer} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Current Selection Indicator */}
      <div className={`p-3 rounded-lg ${withBuffer ? 'bg-primary/10 border border-primary/30' : 'bg-destructive/10 border border-destructive/30'}`}>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${withBuffer ? 'bg-primary' : 'bg-destructive'}`} />
          <span className="text-sm font-medium text-foreground">
            Currently viewing: {withBuffer ? 'With Buffer (4 symbols)' : 'Without Buffer'}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-1 ml-4">
          {withBuffer 
            ? 'Optimized capacity calculation accounting for buffer smoothing effects'
            : 'Raw peak-based capacity calculation without traffic smoothing'}
        </p>
      </div>
    </div>
  );
}

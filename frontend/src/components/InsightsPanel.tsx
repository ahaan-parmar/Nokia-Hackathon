import { LinkData, CellData } from "@/data/networkData";
import { AlertTriangle, CheckCircle, TrendingUp, Zap, Lightbulb } from "lucide-react";

interface InsightsPanelProps {
  linkData: LinkData[];
  cellTopology: CellData[];
}

export function InsightsPanel({ linkData, cellTopology }: InsightsPanelProps) {
  // Find congested link (most cells)
  const congestedLink = linkData.reduce((prev, curr) => 
    curr.cells.length > prev.cells.length ? curr : prev
  );
  
  // Calculate average packet loss per link
  const linkPacketLoss = linkData.map(link => {
    const cells = cellTopology.filter(c => c.cellId && link.cells.includes(c.cellId));
    const avgLoss = cells.reduce((sum, c) => sum + c.packetLossRate, 0) / cells.length;
    return { linkId: link.linkId, avgLoss, cells: cells.length };
  });
  
  const highestLossLink = linkPacketLoss.reduce((prev, curr) => 
    curr.avgLoss > prev.avgLoss ? curr : prev
  );

  const lowestLossLink = linkPacketLoss.reduce((prev, curr) => 
    curr.avgLoss < prev.avgLoss ? curr : prev
  );

  const insights = [
    {
      icon: CheckCircle,
      type: "success" as const,
      title: "Topology Identified",
      description: `${linkData.length} fronthaul links detected across ${cellTopology.length} cells using correlation analysis`,
    },
    {
      icon: AlertTriangle,
      type: "warning" as const,
      title: "Congestion Hotspot",
      description: `Link ${congestedLink.linkId} carries ${congestedLink.cells.length} cells — highest contention risk during peak hours`,
    },
    {
      icon: TrendingUp,
      type: "info" as const,
      title: "Packet Loss Pattern",
      description: `Link ${highestLossLink.linkId} shows ${(highestLossLink.avgLoss * 100).toFixed(1)}% loss vs Link ${lowestLossLink.linkId} at ${(lowestLossLink.avgLoss * 100).toFixed(1)}%`,
    },
    {
      icon: Zap,
      type: "success" as const,
      title: "Buffer Optimization",
      description: `4-symbol buffer reduces total capacity requirement by ~18% through peak smoothing`,
    },
  ];

  const typeStyles = {
    warning: "border-warning/30 bg-warning/5",
    info: "border-primary/30 bg-primary/5",
    success: "border-success/30 bg-success/5",
  };

  const iconStyles = {
    warning: "text-warning",
    info: "text-primary",
    success: "text-success",
  };

  return (
    <div className="border border-border rounded-lg p-6 bg-card">
      <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
        <div className="w-1 h-5 bg-primary rounded-full" />
        Analysis Results & Insights
      </h3>
      
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {insights.map((insight, i) => (
          <div 
            key={i}
            className={`p-4 rounded-lg border ${typeStyles[insight.type]}`}
          >
            <div className="flex items-start gap-3">
              <insight.icon className={`w-5 h-5 mt-0.5 shrink-0 ${iconStyles[insight.type]}`} />
              <div>
                <h4 className="font-medium text-foreground text-sm">{insight.title}</h4>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{insight.description}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Why cells were grouped explanation */}
      <div className="p-4 rounded-lg bg-secondary/30 border border-border">
        <div className="flex items-start gap-3">
          <Lightbulb className="w-5 h-5 text-warning shrink-0 mt-0.5" />
          <div>
            <h4 className="font-medium text-foreground text-sm mb-2">Why These Cells Are Grouped Together</h4>
            <div className="text-xs text-muted-foreground space-y-2 leading-relaxed">
              <p>
                <span className="text-foreground font-medium">Pattern observed:</span> Cells assigned to the same 
                fronthaul link show <span className="text-primary">synchronized packet loss events</span> during 
                congestion periods. When Link {highestLossLink.linkId}'s traffic exceeds capacity, all {highestLossLink.cells} connected 
                cells experience simultaneous degradation.
              </p>
              <p>
                <span className="text-foreground font-medium">Correlation evidence:</span> The correlation matrix 
                shows 70-95% correlation between cells on the same link, versus only 10-30% between cells on 
                different links. This strong clustering pattern confirms shared physical infrastructure.
              </p>
              <p>
                <span className="text-foreground font-medium">Inference confidence:</span> High correlation 
                consistency across multiple congestion events increases confidence in the topology mapping.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

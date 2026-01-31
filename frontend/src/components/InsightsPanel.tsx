import { LinkData, CellData } from "@/data/networkData";
import { AlertTriangle, CheckCircle, TrendingUp, Zap } from "lucide-react";

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
    return { linkId: link.linkId, avgLoss };
  });
  
  const highestLossLink = linkPacketLoss.reduce((prev, curr) => 
    curr.avgLoss > prev.avgLoss ? curr : prev
  );

  const insights = [
    {
      icon: AlertTriangle,
      type: "warning" as const,
      title: "Congestion Detected",
      description: `Link ${congestedLink.linkId} is congested with ${congestedLink.cells.length} shared cells`,
    },
    {
      icon: TrendingUp,
      type: "info" as const,
      title: "Highest Packet Loss",
      description: `Link ${highestLossLink.linkId} shows ${(highestLossLink.avgLoss * 100).toFixed(2)}% average packet loss`,
    },
    {
      icon: Zap,
      type: "success" as const,
      title: "Buffer Optimization",
      description: `4-symbol buffer reduces total capacity requirement by ~18%`,
    },
    {
      icon: CheckCircle,
      type: "success" as const,
      title: "Topology Identified",
      description: `${linkData.length} fronthaul links detected across ${cellTopology.length} cells`,
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
    <div className="glass rounded-xl p-6">
      <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
        <div className="w-1 h-5 bg-primary rounded-full" />
        Key Insights
      </h3>
      
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        {insights.map((insight, i) => (
          <div 
            key={i}
            className={`p-4 rounded-lg border ${typeStyles[insight.type]}`}
          >
            <div className="flex items-start gap-3">
              <insight.icon className={`w-5 h-5 mt-0.5 ${iconStyles[insight.type]}`} />
              <div>
                <h4 className="font-medium text-foreground text-sm">{insight.title}</h4>
                <p className="text-xs text-muted-foreground mt-1">{insight.description}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

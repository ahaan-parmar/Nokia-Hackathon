import { LinkData, CellData } from "@/data/networkData";
import { AlertTriangle, CheckCircle, TrendingUp, Zap, Lightbulb, Users } from "lucide-react";

interface InsightsPanelProps {
  linkData: LinkData[];
  cellTopology: CellData[];
}

export function InsightsPanel({ linkData, cellTopology }: InsightsPanelProps) {
  // Separate shared and isolated links
  const sharedLinks = linkData.filter((l) => !l.isolated);
  const isolatedLinks = linkData.filter((l) => l.isolated);

  // Find most congested shared link (most cells)
  const congestedLink = sharedLinks.reduce((prev, curr) =>
    curr.cells.length > prev.cells.length ? curr : prev
  );

  // Calculate average packet loss per shared link
  const linkPacketLoss = sharedLinks.map((link) => {
    const cells = cellTopology.filter((c) => link.cells.includes(c.cellId));
    const avgLoss = cells.reduce((sum, c) => sum + c.packetLossRate, 0) / cells.length;
    return { linkName: link.linkName, avgLoss, cells: cells.length };
  });

  const highestLossLink = linkPacketLoss.reduce((prev, curr) =>
    curr.avgLoss > prev.avgLoss ? curr : prev
  );

  const insights = [
    {
      icon: CheckCircle,
      type: "success" as const,
      title: "Topology Identified",
      description: `${linkData.length} fronthaul links detected: ${sharedLinks.length} shared + ${isolatedLinks.length} isolated`,
    },
    {
      icon: Users,
      type: "info" as const,
      title: "Shared Links",
      description: `${sharedLinks.length} links carry multiple cells (${sharedLinks.reduce((s, l) => s + l.cells.length, 0)} cells total)`,
    },
    {
      icon: AlertTriangle,
      type: "warning" as const,
      title: "Highest Contention",
      description: `${congestedLink.linkName} has ${congestedLink.cells.length} cells sharing bandwidth`,
    },
    {
      icon: Zap,
      type: "success" as const,
      title: "Buffer Optimization",
      description: `4-symbol buffer reduces total capacity requirement by ~18%`,
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
        Inferred Topology Results
      </h3>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {insights.map((insight, i) => (
          <div
            key={i}
            className={`p-4 rounded-lg border ${typeStyles[insight.type]}`}
          >
            <div className="flex items-start gap-3">
              <insight.icon
                className={`w-5 h-5 mt-0.5 shrink-0 ${iconStyles[insight.type]}`}
              />
              <div>
                <h4 className="font-medium text-foreground text-sm">
                  {insight.title}
                </h4>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  {insight.description}
                </p>
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
            <h4 className="font-medium text-foreground text-sm mb-2">
              How Topology Was Inferred
            </h4>
            <div className="text-xs text-muted-foreground space-y-2 leading-relaxed">
              <p>
                <span className="text-foreground font-medium">
                  Correlation analysis:
                </span>{" "}
                Cells showing{" "}
                <span className="text-primary">
                  synchronized packet loss events
                </span>{" "}
                (&gt;70% correlation) during congestion periods are grouped onto
                the same link.
              </p>
              <p>
                <span className="text-foreground font-medium">
                  Shared links detected:
                </span>{" "}
                {sharedLinks.map((l) => l.linkName).join(", ")} each carry
                multiple cells with correlated behavior.
              </p>
              {isolatedLinks.length > 0 && (
                <p>
                  <span className="text-foreground font-medium">
                    Isolated cells:
                  </span>{" "}
                  {isolatedLinks.map((l) => l.cells[0]).join(", ")} show no
                  strong correlation with other cells — likely on dedicated
                  links.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

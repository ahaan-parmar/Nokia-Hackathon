import { CellData, linkColors } from "@/data/networkData";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface TopologyTableProps {
  cellTopology: CellData[];
}

export function TopologyTable({ cellTopology }: TopologyTableProps) {
  const groupedByLink = cellTopology.reduce((acc, cell) => {
    if (!acc[cell.linkId]) acc[cell.linkId] = [];
    acc[cell.linkId].push(cell);
    return acc;
  }, {} as Record<number, CellData[]>);

  const sortedLinks = Object.entries(groupedByLink).sort(
    (a, b) => parseInt(a[0]) - parseInt(b[0])
  );

  // Separate shared and isolated links
  const sharedLinks = sortedLinks.filter(([_, cells]) => cells.length > 1);
  const isolatedLinks = sortedLinks.filter(([_, cells]) => cells.length === 1);

  return (
    <ScrollArea className="h-[450px]">
      <div className="space-y-6 pr-4 pb-6">
        {/* Shared Links */}
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-3">
            Shared Links ({sharedLinks.length})
          </h4>
          <div className="space-y-3">
            {sharedLinks.map(([linkId, cells]) => {
              const color = linkColors[parseInt(linkId)] || "#888";
              return (
                <div
                  key={linkId}
                  className="p-4 rounded-lg bg-secondary/30 border-l-4"
                  style={{ borderLeftColor: color }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: color }}
                      />
                      <span className="font-semibold" style={{ color }}>
                        {cells[0].linkName}
                      </span>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {cells.length} cells
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {cells.map((cell) => (
                      <div
                        key={cell.cellId}
                        className="px-3 py-1.5 rounded-md bg-background text-sm text-foreground border border-border"
                      >
                        <span className="font-mono text-xs">{cell.cellId}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Isolated Cells */}
        {isolatedLinks.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-3">
              Isolated Cells ({isolatedLinks.length})
            </h4>
            <div className="grid grid-cols-2 gap-2">
              {isolatedLinks.map(([linkId, cells]) => {
                const cell = cells[0];
                const color = linkColors[parseInt(linkId)] || "#888";
                return (
                  <div
                    key={linkId}
                    className="p-3 rounded-lg bg-secondary/20 border border-border flex items-center gap-3"
                  >
                    <div
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs text-foreground">
                          {cell.cellId}
                        </span>
                        <span
                          className="text-xs font-medium"
                          style={{ color }}
                        >
                          {cell.linkName}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </ScrollArea>
  );
}

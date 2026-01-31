import { CellData, linkColorClasses } from "@/data/networkData";
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

  return (
    <ScrollArea className="h-[400px]">
      <div className="space-y-4">
        {Object.entries(groupedByLink).map(([linkId, cells]) => (
          <div 
            key={linkId} 
            className={`p-4 rounded-lg bg-secondary/30 border-l-4 ${linkColorClasses[parseInt(linkId)].border}`}
          >
            <div className="flex items-center justify-between mb-3">
              <h4 className={`font-semibold ${linkColorClasses[parseInt(linkId)].text}`}>
                Link {linkId}
              </h4>
              <Badge variant="secondary" className="text-xs">
                {cells.length} cells
              </Badge>
            </div>
            <div className="flex flex-wrap gap-2">
              {cells.map((cell) => (
                <div 
                  key={cell.cellId}
                  className="px-3 py-1.5 rounded-md bg-background text-sm text-foreground border border-border hover:border-primary/50 transition-colors cursor-default"
                >
                  <span className="font-mono text-xs">{cell.cellId}</span>
                  <span className="ml-2 text-muted-foreground text-xs">
                    {cell.avgTraffic.toFixed(1)} Gbps
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}

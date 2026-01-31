import { LinkData, CellData, linkColors } from "@/data/networkData";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface SummaryTableProps {
  linkData: LinkData[];
  cellTopology: CellData[];
}

export function SummaryTable({ linkData }: SummaryTableProps) {
  // Separate shared and isolated links
  const sharedLinks = linkData.filter((l) => !l.isolated);
  const isolatedLinks = linkData.filter((l) => l.isolated);

  return (
    <div className="overflow-auto">
      <Table>
        <TableHeader>
          <TableRow className="border-border hover:bg-transparent">
            <TableHead className="text-muted-foreground">Link</TableHead>
            <TableHead className="text-muted-foreground">Cells</TableHead>
            <TableHead className="text-muted-foreground text-right">Avg Traffic</TableHead>
            <TableHead className="text-muted-foreground text-right">Peak Traffic</TableHead>
            <TableHead className="text-muted-foreground text-right">Capacity (w/ Buffer)</TableHead>
            <TableHead className="text-muted-foreground text-right">Capacity (w/o Buffer)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {/* Shared Links */}
          {sharedLinks.map((link) => {
            const color = linkColors[link.linkId] || "#888";
            return (
              <TableRow key={link.linkId} className="border-border hover:bg-secondary/30">
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                    <span className="font-medium" style={{ color }}>
                      {link.linkName}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1 max-w-[180px]">
                    {link.cells.map((cellId) => (
                      <Badge key={cellId} variant="secondary" className="text-xs font-mono">
                        {cellId}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell className="text-right font-mono text-sm">
                  {link.avgTraffic.toFixed(2)} Gbps
                </TableCell>
                <TableCell className="text-right font-mono text-sm">
                  {link.peakTraffic.toFixed(2)} Gbps
                </TableCell>
                <TableCell className="text-right">
                  <span className="font-mono text-sm text-primary">
                    {link.requiredCapacityWithBuffer.toFixed(2)} Gbps
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <span className="font-mono text-sm text-destructive">
                    {link.requiredCapacityWithoutBuffer.toFixed(2)} Gbps
                  </span>
                </TableCell>
              </TableRow>
            );
          })}

          {/* Isolated Links */}
          {isolatedLinks.length > 0 && (
            <TableRow className="border-border bg-muted/20">
              <TableCell colSpan={6} className="text-xs text-muted-foreground py-2">
                Isolated Cells (dedicated links)
              </TableCell>
            </TableRow>
          )}
          {isolatedLinks.map((link) => {
            const color = linkColors[link.linkId] || "#888";
            return (
              <TableRow key={link.linkId} className="border-border hover:bg-secondary/30">
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-sm text-muted-foreground">
                      {link.linkName}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs font-mono">
                    {link.cells[0]}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-mono text-sm text-muted-foreground">
                  {link.avgTraffic.toFixed(2)} Gbps
                </TableCell>
                <TableCell className="text-right font-mono text-sm text-muted-foreground">
                  {link.peakTraffic.toFixed(2)} Gbps
                </TableCell>
                <TableCell className="text-right">
                  <span className="font-mono text-sm text-muted-foreground">
                    {link.requiredCapacityWithBuffer.toFixed(2)} Gbps
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <span className="font-mono text-sm text-muted-foreground">
                    {link.requiredCapacityWithoutBuffer.toFixed(2)} Gbps
                  </span>
                </TableCell>
              </TableRow>
            );
          })}

          {/* Totals Row */}
          <TableRow className="border-border bg-secondary/30 font-medium">
            <TableCell>
              <span className="text-foreground font-semibold">Total</span>
            </TableCell>
            <TableCell>
              <Badge variant="secondary" className="text-xs">
                {linkData.reduce((sum, l) => sum + l.cells.length, 0)} cells · {linkData.length} links
              </Badge>
            </TableCell>
            <TableCell className="text-right font-mono text-sm">
              {linkData.reduce((sum, l) => sum + l.avgTraffic, 0).toFixed(2)} Gbps
            </TableCell>
            <TableCell className="text-right font-mono text-sm">
              {linkData.reduce((sum, l) => sum + l.peakTraffic, 0).toFixed(2)} Gbps
            </TableCell>
            <TableCell className="text-right">
              <span className="font-mono text-sm text-primary font-bold">
                {linkData.reduce((sum, l) => sum + l.requiredCapacityWithBuffer, 0).toFixed(2)} Gbps
              </span>
            </TableCell>
            <TableCell className="text-right">
              <span className="font-mono text-sm text-destructive font-bold">
                {linkData.reduce((sum, l) => sum + l.requiredCapacityWithoutBuffer, 0).toFixed(2)} Gbps
              </span>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}

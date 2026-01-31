import { LinkData, CellData, linkColorClasses } from "@/data/networkData";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface SummaryTableProps {
  linkData: LinkData[];
  cellTopology: CellData[];
}

export function SummaryTable({ linkData, cellTopology }: SummaryTableProps) {
  return (
    <div className="overflow-auto">
      <Table>
        <TableHeader>
          <TableRow className="border-border hover:bg-transparent">
            <TableHead className="text-muted-foreground">Link</TableHead>
            <TableHead className="text-muted-foreground">Cells Connected</TableHead>
            <TableHead className="text-muted-foreground text-right">Avg Traffic (Gbps)</TableHead>
            <TableHead className="text-muted-foreground text-right">Peak Traffic (Gbps)</TableHead>
            <TableHead className="text-muted-foreground text-right">Req. Capacity w/ Buffer</TableHead>
            <TableHead className="text-muted-foreground text-right">Req. Capacity w/o Buffer</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {linkData.map((link) => (
            <TableRow key={link.linkId} className="border-border hover:bg-secondary/30">
              <TableCell>
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${linkColorClasses[link.linkId]?.bg || 'bg-primary'}`} />
                  <span className={`font-medium ${linkColorClasses[link.linkId]?.text || 'text-primary'}`}>
                    Link {link.linkId}
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1 max-w-[200px]">
                  {link.cells.slice(0, 4).map((cellId) => (
                    <Badge key={cellId} variant="secondary" className="text-xs font-mono">
                      {cellId}
                    </Badge>
                  ))}
                  {link.cells.length > 4 && (
                    <Badge variant="outline" className="text-xs">
                      +{link.cells.length - 4} more
                    </Badge>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-right font-mono">
                {link.avgTraffic.toFixed(2)}
              </TableCell>
              <TableCell className="text-right font-mono">
                {link.peakTraffic.toFixed(2)}
              </TableCell>
              <TableCell className="text-right">
                <span className="font-mono text-primary">{link.requiredCapacityWithBuffer.toFixed(2)}</span>
              </TableCell>
              <TableCell className="text-right">
                <span className="font-mono text-destructive">{link.requiredCapacityWithoutBuffer.toFixed(2)}</span>
              </TableCell>
            </TableRow>
          ))}
          
          {/* Totals Row */}
          <TableRow className="border-border bg-secondary/20 font-medium">
            <TableCell>
              <span className="text-foreground">Total</span>
            </TableCell>
            <TableCell>
              <Badge variant="secondary" className="text-xs">
                {linkData.reduce((sum, l) => sum + l.cells.length, 0)} cells
              </Badge>
            </TableCell>
            <TableCell className="text-right font-mono">
              {linkData.reduce((sum, l) => sum + l.avgTraffic, 0).toFixed(2)}
            </TableCell>
            <TableCell className="text-right font-mono">
              {linkData.reduce((sum, l) => sum + l.peakTraffic, 0).toFixed(2)}
            </TableCell>
            <TableCell className="text-right">
              <span className="font-mono text-primary font-bold">
                {linkData.reduce((sum, l) => sum + l.requiredCapacityWithBuffer, 0).toFixed(2)}
              </span>
            </TableCell>
            <TableCell className="text-right">
              <span className="font-mono text-destructive font-bold">
                {linkData.reduce((sum, l) => sum + l.requiredCapacityWithoutBuffer, 0).toFixed(2)}
              </span>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}

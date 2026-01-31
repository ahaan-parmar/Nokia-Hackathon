import { useMemo } from "react";
import { generateCorrelationMatrix, cellTopology } from "@/data/networkData";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function CorrelationHeatmap() {
  const { cells, matrix } = useMemo(() => generateCorrelationMatrix(), []);
  
  // Group cells by link for better visualization
  const cellLinkMap = useMemo(() => {
    const map: Record<string, number> = {};
    cellTopology.forEach(cell => {
      map[cell.cellId] = cell.linkId;
    });
    return map;
  }, []);

  const getColor = (value: number) => {
    if (value > 0.8) return "bg-primary";
    if (value > 0.6) return "bg-primary/70";
    if (value > 0.4) return "bg-accent/60";
    if (value > 0.2) return "bg-accent/30";
    return "bg-secondary";
  };

  // Show only first 12 cells for better visibility
  const displayCells = cells.slice(0, 12);
  const displayMatrix = matrix.slice(0, 12).map(row => row.slice(0, 12));

  return (
    <div className="space-y-4">
      <div className="text-xs text-muted-foreground">
        High correlation (bright) indicates cells sharing the same fronthaul link
      </div>
      
      <div className="overflow-auto">
        <div className="inline-block min-w-max">
          {/* Header */}
          <div className="flex">
            <div className="w-16 h-8" />
            {displayCells.map((cell, i) => (
              <div 
                key={cell} 
                className="w-8 h-8 flex items-center justify-center text-[10px] text-muted-foreground -rotate-45 origin-center"
              >
                {i + 1}
              </div>
            ))}
          </div>
          
          {/* Matrix */}
          {displayMatrix.map((row, i) => (
            <div key={displayCells[i]} className="flex items-center">
              <div className="w-16 h-8 flex items-center text-xs text-muted-foreground pr-2">
                Cell-{String(i + 1).padStart(2, '0')}
              </div>
              {row.map((value, j) => (
                <Tooltip key={j}>
                  <TooltipTrigger>
                    <div 
                      className={`w-8 h-8 ${getColor(value)} border border-background/20 transition-opacity hover:opacity-80`}
                    />
                  </TooltipTrigger>
                  <TooltipContent className="bg-popover border-border">
                    <div className="text-xs">
                      <div className="font-medium">
                        {displayCells[i]} ↔ {displayCells[j]}
                      </div>
                      <div className="text-muted-foreground">
                        Correlation: {(value * 100).toFixed(1)}%
                      </div>
                      <div className="text-muted-foreground">
                        {cellLinkMap[displayCells[i]] === cellLinkMap[displayCells[j]] 
                          ? `Same Link (${cellLinkMap[displayCells[i]]})` 
                          : 'Different Links'}
                      </div>
                    </div>
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground mt-4">
        <span>Correlation:</span>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 bg-secondary rounded" />
            <span>Low</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 bg-accent/60 rounded" />
            <span>Medium</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 bg-primary rounded" />
            <span>High</span>
          </div>
        </div>
      </div>
    </div>
  );
}

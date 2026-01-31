import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Network, ArrowLeft, Play, RefreshCw } from "lucide-react";
import { datasets, calculateLinkData, cellTopology } from "@/data/networkData";
import { TopologyTable } from "@/components/TopologyTable";
import { TrafficChart } from "@/components/TrafficChart";
import { CorrelationHeatmap } from "@/components/CorrelationHeatmap";
import { BufferAnalysis } from "@/components/BufferAnalysis";
import { SummaryTable } from "@/components/SummaryTable";
import { InsightsPanel } from "@/components/InsightsPanel";

const Analysis = () => {
  const [selectedDataset, setSelectedDataset] = useState<string>("");
  const [withBuffer, setWithBuffer] = useState(true);
  const [analysisRun, setAnalysisRun] = useState(false);
  const [selectedLink, setSelectedLink] = useState<number>(1);

  const linkData = useMemo(() => calculateLinkData(), []);

  const handleRunAnalysis = () => {
    setAnalysisRun(true);
  };

  const handleReset = () => {
    setAnalysisRun(false);
    setSelectedDataset("");
    setWithBuffer(true);
    setSelectedLink(1);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border sticky top-0 bg-background/80 backdrop-blur-lg z-50">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/">
              <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Network className="w-5 h-5 text-primary" />
              </div>
              <span className="font-semibold text-foreground">Topology Analysis</span>
            </div>
          </div>
          
          {analysisRun && (
            <Button variant="outline" onClick={handleReset} className="gap-2">
              <RefreshCw className="w-4 h-4" />
              Reset
            </Button>
          )}
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        {/* Controls */}
        <div className="glass rounded-xl p-6 mb-8">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-6">
            Analysis Configuration
          </h2>
          
          <div className="flex flex-wrap items-end gap-6">
            <div className="flex-1 min-w-[200px]">
              <Label className="text-sm text-muted-foreground mb-2 block">Select Dataset</Label>
              <Select value={selectedDataset} onValueChange={setSelectedDataset}>
                <SelectTrigger className="bg-background border-border">
                  <SelectValue placeholder="Choose a dataset..." />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  {datasets.map((dataset) => (
                    <SelectItem key={dataset.id} value={dataset.id}>
                      <div className="flex flex-col">
                        <span>{dataset.name}</span>
                        <span className="text-xs text-muted-foreground">{dataset.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-4 p-4 rounded-lg bg-secondary/50">
              <div className="flex items-center gap-3">
                <Switch 
                  id="buffer-mode" 
                  checked={withBuffer} 
                  onCheckedChange={setWithBuffer}
                  className="data-[state=checked]:bg-primary"
                />
                <Label htmlFor="buffer-mode" className="text-sm">
                  {withBuffer ? "With Buffer (4 symbols)" : "Without Buffer"}
                </Label>
              </div>
            </div>

            <Button 
              onClick={handleRunAnalysis}
              disabled={!selectedDataset}
              className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2 px-6"
            >
              <Play className="w-4 h-4" />
              Run Analysis
            </Button>
          </div>
        </div>

        {/* Results */}
        {analysisRun && (
          <div className="space-y-8 animate-fade-in">
            {/* Insights Panel */}
            <InsightsPanel linkData={linkData} cellTopology={cellTopology} />

            {/* Main Grid */}
            <div className="grid lg:grid-cols-2 gap-8">
              {/* Topology Mapping */}
              <div className="glass rounded-xl p-6">
                <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                  <div className="w-1 h-5 bg-primary rounded-full" />
                  Topology Mapping
                </h3>
                <p className="text-sm text-muted-foreground mb-6">
                  Cell to Link assignment based on traffic correlation analysis
                </p>
                <TopologyTable cellTopology={cellTopology} />
              </div>

              {/* Correlation Heatmap */}
              <div className="glass rounded-xl p-6">
                <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                  <div className="w-1 h-5 bg-accent rounded-full" />
                  Traffic Correlation
                </h3>
                <p className="text-sm text-muted-foreground mb-6">
                  Congestion correlation matrix revealing shared infrastructure
                </p>
                <CorrelationHeatmap />
              </div>
            </div>

            {/* Traffic Analysis */}
            <div className="glass rounded-xl p-6">
              <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                <div>
                  <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                    <div className="w-1 h-5 bg-primary rounded-full" />
                    Aggregated Link Traffic
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Data rate over time for selected link
                  </p>
                </div>
                
                <Select 
                  value={selectedLink.toString()} 
                  onValueChange={(v) => setSelectedLink(parseInt(v))}
                >
                  <SelectTrigger className="w-[180px] bg-background border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    {linkData.map((link) => (
                      <SelectItem key={link.linkId} value={link.linkId.toString()}>
                        Link {link.linkId} ({link.cells.length} cells)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <TrafficChart linkId={selectedLink} />
            </div>

            {/* Buffer Impact Analysis */}
            <div className="glass rounded-xl p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <div className="w-1 h-5 bg-warning rounded-full" />
                Buffer Impact Analysis
              </h3>
              <BufferAnalysis linkData={linkData} withBuffer={withBuffer} />
            </div>

            {/* Summary Table */}
            <div className="glass rounded-xl p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <div className="w-1 h-5 bg-success rounded-full" />
                Summary Table
              </h3>
              <p className="text-sm text-muted-foreground mb-6">
                Complete overview of all fronthaul links with capacity requirements
              </p>
              <SummaryTable linkData={linkData} cellTopology={cellTopology} />
            </div>
          </div>
        )}

        {/* Empty State */}
        {!analysisRun && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="p-4 rounded-2xl bg-secondary/50 mb-6">
              <Network className="w-12 h-12 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">Ready to Analyze</h3>
            <p className="text-muted-foreground max-w-md">
              Select a dataset and configure buffer settings, then click "Run Analysis" 
              to identify fronthaul topology from traffic patterns.
            </p>
          </div>
        )}
      </main>
    </div>
  );
};

export default Analysis;

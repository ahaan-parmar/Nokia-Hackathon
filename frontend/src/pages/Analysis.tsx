import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Network, Play, RefreshCw, Moon, Sun } from "lucide-react";
import { datasets, calculateLinkData, cellTopology, linkColors } from "@/data/networkData";
import { TopologyTable } from "@/components/TopologyTable";
import { TrafficChart } from "@/components/TrafficChart";
import { CellTrafficChart } from "@/components/CellTrafficChart";
import { CorrelationHeatmap } from "@/components/CorrelationHeatmap";
import { BufferAnalysis } from "@/components/BufferAnalysis";
import { SummaryTable } from "@/components/SummaryTable";
import { InsightsPanel } from "@/components/InsightsPanel";

const Analysis = () => {
  const [selectedDataset, setSelectedDataset] = useState<string>("");
  const [withBuffer, setWithBuffer] = useState(true);
  const [analysisRun, setAnalysisRun] = useState(false);
  const [selectedLinks, setSelectedLinks] = useState<number[]>([1]);
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("theme");
      return saved === "dark" || (!saved && window.matchMedia("(prefers-color-scheme: dark)").matches);
    }
    return true;
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [darkMode]);

  const linkData = useMemo(() => calculateLinkData(), []);

  const handleRunAnalysis = () => {
    setAnalysisRun(true);
  };

  const handleReset = () => {
    setAnalysisRun(false);
    setSelectedDataset("");
    setWithBuffer(true);
    setSelectedLinks([1]);
  };

  const toggleLink = (linkId: number) => {
    setSelectedLinks((prev) => {
      if (prev.includes(linkId)) {
        if (prev.length === 1) return prev;
        return prev.filter((id) => id !== linkId);
      }
      return [...prev, linkId].sort((a, b) => a - b);
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border sticky top-0 bg-background z-50">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Network className="w-5 h-5 text-primary" />
            </div>
            <span className="font-semibold text-foreground">Fronthaul Analyzer</span>
          </div>
          
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setDarkMode(!darkMode)}
              className="h-9 w-9"
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>
            
            {analysisRun && (
              <Button variant="outline" onClick={handleReset} className="gap-2">
                <RefreshCw className="w-4 h-4" />
                Reset
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        {/* Controls */}
        <div className="border border-border rounded-lg p-6 mb-8 bg-card">
          <h2 className="text-sm font-medium text-muted-foreground mb-6">
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
          <div className="space-y-8">
            {/* Insights Panel */}
            <InsightsPanel linkData={linkData} cellTopology={cellTopology} />

            {/* Main Grid */}
            <div className="grid lg:grid-cols-2 gap-8">
              {/* Topology Mapping */}
              <div className="border border-border rounded-lg p-6 bg-card">
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
              <div className="border border-border rounded-lg p-6 bg-card">
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

            {/* Cell-wise Traffic Visualization */}
            <div className="border border-border rounded-lg p-6 bg-card">
              <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <div className="w-1 h-5 bg-primary rounded-full" />
                Cell-wise Traffic Analysis
              </h3>
              <p className="text-sm text-muted-foreground mb-6">
                Compare throughput and packet loss patterns across individual cells. 
                Cells on the same link show correlated behavior during congestion.
              </p>
              
              <Tabs defaultValue="throughput" className="w-full">
                <TabsList className="mb-4">
                  <TabsTrigger value="throughput">Throughput</TabsTrigger>
                  <TabsTrigger value="packetLoss">Packet Loss</TabsTrigger>
                </TabsList>
                <TabsContent value="throughput">
                  <CellTrafficChart mode="throughput" />
                </TabsContent>
                <TabsContent value="packetLoss">
                  <CellTrafficChart mode="packetLoss" />
                </TabsContent>
              </Tabs>
            </div>

            {/* Aggregated Link Traffic */}
            <div className="border border-border rounded-lg p-6 bg-card">
              <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                <div>
                  <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                    <div className="w-1 h-5 bg-accent rounded-full" />
                    Aggregated Link Traffic
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Combined traffic of all cells per inferred fronthaul link
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 mb-4">
                <span className="text-sm text-muted-foreground">Shared links:</span>
                {linkData.filter(l => !l.isolated).map((link) => (
                  <label
                    key={link.linkId}
                    className="flex items-center gap-2 cursor-pointer text-sm"
                  >
                    <Checkbox
                      checked={selectedLinks.includes(link.linkId)}
                      onCheckedChange={() => toggleLink(link.linkId)}
                    />
                    <span style={{ color: linkColors[link.linkId] }}>
                      {link.linkName} ({link.cells.length})
                    </span>
                  </label>
                ))}
                <span className="text-sm text-muted-foreground ml-2">Isolated:</span>
                {linkData.filter(l => l.isolated).map((link) => (
                  <label
                    key={link.linkId}
                    className="flex items-center gap-2 cursor-pointer text-sm"
                  >
                    <Checkbox
                      checked={selectedLinks.includes(link.linkId)}
                      onCheckedChange={() => toggleLink(link.linkId)}
                    />
                    <span className="text-muted-foreground">
                      {link.linkName}
                    </span>
                  </label>
                ))}
              </div>
              
              <TrafficChart linkIds={selectedLinks} />
            </div>

            {/* Buffer Impact Analysis */}
            <div className="border border-border rounded-lg p-6 bg-card">
              <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <div className="w-1 h-5 bg-warning rounded-full" />
                Buffer Impact Analysis
              </h3>
              <BufferAnalysis linkData={linkData} withBuffer={withBuffer} />
            </div>

            {/* Summary Table */}
            <div className="border border-border rounded-lg p-6 bg-card">
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
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Network className="w-10 h-10 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-1">Ready to analyze</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              Select a dataset, set buffer option, then Run Analysis.
            </p>
          </div>
        )}
      </main>
    </div>
  );
};

export default Analysis;

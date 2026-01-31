import { useState, useMemo, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Network, Play, RefreshCw, Moon, Sun, Loader2, AlertCircle, Zap } from "lucide-react";
import { datasets, calculateLinkData, cellTopology, linkColors, CellData, LinkData } from "@/data/networkData";
import { TopologyTable } from "@/components/TopologyTable";
import { TrafficChart } from "@/components/TrafficChart";
import { CellTrafficChart } from "@/components/CellTrafficChart";
import { CorrelationHeatmap } from "@/components/CorrelationHeatmap";
import { BufferAnalysis } from "@/components/BufferAnalysis";
import { SummaryTable } from "@/components/SummaryTable";
import { InsightsPanel } from "@/components/InsightsPanel";
import { NetworkTopology } from "@/components/NetworkTopology";
import { LinkTrafficVisualization } from "@/components/LinkTrafficVisualization";
import { CongestionPrediction } from "@/components/CongestionPrediction";
import {
  runAnalysis,
  getCellStats,
  getLinkStats,
  checkBackendHealth,
  type CellStat,
  type LinkStat,
  type AnalysisResult
} from "@/services/api";

// Animated counter component
function AnimatedCounter({ value, duration = 1000 }: { value: number; duration?: number }) {
  const [displayValue, setDisplayValue] = useState(0);
  const startTimeRef = useRef<number | null>(null);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    startTimeRef.current = null;

    const animate = (timestamp: number) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const progress = Math.min((timestamp - startTimeRef.current) / duration, 1);

      // Easing function for smooth animation
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      setDisplayValue(Math.floor(easeOutQuart * value));

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [value, duration]);

  return <>{displayValue.toLocaleString()}</>;
}

const Analysis = () => {
  const [selectedDataset, setSelectedDataset] = useState<string>("");
  const [withBuffer, setWithBuffer] = useState(true);
  const [analysisRun, setAnalysisRun] = useState(false);
  const [selectedLinks, setSelectedLinks] = useState<number[]>([1]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [backendAvailable, setBackendAvailable] = useState<boolean | null>(null);

  // Live data from backend
  const [liveAnalysis, setLiveAnalysis] = useState<AnalysisResult | null>(null);
  const [liveCellStats, setLiveCellStats] = useState<CellStat[] | null>(null);
  const [liveLinkStats, setLiveLinkStats] = useState<LinkStat[] | null>(null);

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

  // Check backend availability on mount
  useEffect(() => {
    checkBackendHealth().then(setBackendAvailable);
  }, []);

  // Determine if we're using live data
  const isLiveMode = selectedDataset === "live-analysis";

  // Get link data - either from backend or static
  const linkData = useMemo((): LinkData[] => {
    if (isLiveMode && liveLinkStats) {
      return liveLinkStats.map(link => ({
        linkId: link.linkId,
        linkName: link.linkName,
        cells: link.cells,
        color: linkColors[link.linkId] || "#888",
        avgTraffic: link.avgThroughput / 1000,
        peakTraffic: link.peakThroughput / 1000,
        requiredCapacityWithBuffer: (link.peakThroughput / 1000) * 1.02,
        requiredCapacityWithoutBuffer: (link.peakThroughput / 1000) * 1.2,
        isolated: link.isolated,
      }));
    }
    return calculateLinkData();
  }, [isLiveMode, liveLinkStats]);

  // Get cell topology - either from backend or static
  const currentCellTopology = useMemo((): CellData[] => {
    if (isLiveMode && liveCellStats) {
      return liveCellStats.map(cell => ({
        cellId: cell.cellId,
        linkId: cell.linkId,
        linkName: cell.linkName,
        avgTraffic: cell.avgThroughput / 1000,
        peakTraffic: cell.peakThroughput / 1000,
        packetLossRate: cell.packetLossRate,
        isolated: cell.isolated,
      }));
    }
    return cellTopology;
  }, [isLiveMode, liveCellStats]);

  const handleRunAnalysis = async () => {
    setError(null);

    if (isLiveMode) {
      setIsLoading(true);
      try {
        const [analysis, cellStats, linkStats] = await Promise.all([
          runAnalysis(),
          getCellStats(),
          getLinkStats(),
        ]);

        setLiveAnalysis(analysis);
        setLiveCellStats(cellStats);
        setLiveLinkStats(linkStats);
        setAnalysisRun(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch data from backend");
      } finally {
        setIsLoading(false);
      }
    } else {
      setAnalysisRun(true);
    }
  };

  const handleReset = () => {
    setAnalysisRun(false);
    setSelectedDataset("");
    setWithBuffer(true);
    setSelectedLinks([1]);
    setError(null);
    setLiveAnalysis(null);
    setLiveCellStats(null);
    setLiveLinkStats(null);
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

  const liveSummary = liveAnalysis?.summary;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border sticky top-0 bg-background/95 backdrop-blur-sm z-50">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 transition-all hover:bg-primary/20">
              <Network className="w-5 h-5 text-primary" />
            </div>
            <span className="font-semibold text-foreground">Fronthaul Analyzer</span>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setDarkMode(!darkMode)}
              className="h-9 w-9 transition-all hover:scale-105"
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>

            {analysisRun && (
              <Button variant="outline" onClick={handleReset} className="gap-2 transition-all hover:scale-105">
                <RefreshCw className="w-4 h-4" />
                Reset
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        {/* Controls */}
        <div className="border border-border rounded-lg p-6 mb-8 bg-card animate-fade-in">
          <h2 className="text-sm font-medium text-muted-foreground mb-6">
            Analysis Configuration
          </h2>

          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-4">
              <Label className="text-sm text-muted-foreground w-24">Dataset</Label>
              <Select value={selectedDataset} onValueChange={setSelectedDataset}>
                <SelectTrigger className="bg-background border-border h-10 w-[350px] transition-all hover:border-primary/50">
                  <SelectValue placeholder="Choose a dataset..." />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  {datasets.map((dataset) => (
                    <SelectItem
                      key={dataset.id}
                      value={dataset.id}
                      className="py-2 transition-colors"
                      disabled={dataset.id === "live-analysis" && backendAvailable === false}
                    >
                      <div className="flex items-center gap-2">
                        <span>{dataset.name}</span>
                        {dataset.id === "live-analysis" && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded transition-all ${backendAvailable === true
                            ? "bg-green-500/20 text-green-400"
                            : backendAvailable === false
                              ? "bg-red-500/20 text-red-400"
                              : "bg-yellow-500/20 text-yellow-400"
                            }`}>
                            {backendAvailable === true ? "Online" : backendAvailable === false ? "Offline" : "Checking..."}
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex items-center gap-3 h-10 px-4 rounded-lg bg-secondary/50 transition-all hover:bg-secondary/70">
                <Switch
                  id="buffer-mode"
                  checked={withBuffer}
                  onCheckedChange={setWithBuffer}
                  className="data-[state=checked]:bg-primary"
                />
                <Label htmlFor="buffer-mode" className="text-sm whitespace-nowrap">
                  {withBuffer ? "With Buffer (4 symbols)" : "Without Buffer"}
                </Label>
              </div>

              <Button
                onClick={handleRunAnalysis}
                disabled={!selectedDataset || isLoading}
                className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2 px-6 h-10 transition-all hover:scale-105 hover:shadow-lg hover:shadow-primary/25"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    Run Analysis
                  </>
                )}
              </Button>
            </div>

            {selectedDataset && (
              <div className="text-xs text-muted-foreground pl-28 animate-fade-in">
                {datasets.find(d => d.id === selectedDataset)?.description}
                {" • "}
                <span className="font-mono text-muted-foreground/60">
                  {datasets.find(d => d.id === selectedDataset)?.source}
                </span>
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 text-sm text-red-400 pl-28 animate-slide-in-right">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}
          </div>
        </div>

        {/* Live Data Summary Banner */}
        {analysisRun && isLiveMode && liveSummary && (
          <div className="border border-green-500/30 rounded-lg p-5 mb-8 bg-green-500/5 relative overflow-hidden animate-slide-up">
            {/* Flowing data effect */}
            <div className="absolute inset-0 data-flow-bg opacity-30" />

            <div className="relative">
              <div className="flex items-center gap-3 mb-4">
                <div className="relative">
                  <Zap className="w-6 h-6 text-green-400" />
                  <div className="absolute inset-0 animate-ping">
                    <Zap className="w-6 h-6 text-green-400 opacity-50" />
                  </div>
                </div>
                <span className="font-semibold text-green-400 text-lg">Live Analysis Results</span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div className="animate-slide-up stagger-1">
                  <div className="text-muted-foreground text-sm mb-1">Data Points</div>
                  <div className="text-2xl font-bold text-foreground">
                    <AnimatedCounter value={liveSummary.total_data_points} duration={1500} />
                  </div>
                </div>
                <div className="animate-slide-up stagger-2">
                  <div className="text-muted-foreground text-sm mb-1">Cells Analyzed</div>
                  <div className="text-2xl font-bold text-foreground">
                    <AnimatedCounter value={liveSummary.total_cells} duration={800} />
                  </div>
                </div>
                <div className="animate-slide-up stagger-3">
                  <div className="text-muted-foreground text-sm mb-1">Inferred Links</div>
                  <div className="text-2xl font-bold text-foreground">
                    <AnimatedCounter value={liveSummary.inferred_links} duration={800} />
                  </div>
                </div>
                <div className="animate-slide-up stagger-4">
                  <div className="text-muted-foreground text-sm mb-1">Congestion Events</div>
                  <div className="text-2xl font-bold text-foreground">
                    <AnimatedCounter value={liveSummary.congestion_events} duration={1200} />
                  </div>
                </div>
              </div>

              <div className="mt-4 text-xs text-muted-foreground flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                Algorithm: {liveSummary.algorithm} • Source: {liveSummary.data_source}
              </div>
            </div>
          </div>
        )}

        {/* Results */}
        {analysisRun && (
          <div className="space-y-8">
            {/* 1. Network Topology - Core Deliverable */}
            <div className="border border-border rounded-lg p-6 bg-card animate-slide-up transition-all hover:border-primary/30">
              <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <div className="w-1 h-5 bg-primary rounded-full" />
                Network Topology
                <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full ml-2">
                  Core Deliverable
                </span>
              </h3>
              <p className="text-sm text-muted-foreground mb-6">
                Dynamic visualization of the inferred fronthaul topology.
                BBU at center, links in middle ring, cells on the outer ring.
              </p>
              <NetworkTopology />
            </div>

            {/* 2. Insights Panel - Topology Interpretation */}
            <div className="animate-slide-up stagger-1">
              <InsightsPanel linkData={linkData} cellTopology={currentCellTopology} />
            </div>

            {/* 3. ML Congestion Prediction - Optional Extension (Live Mode Only) */}
            {isLiveMode && (
              <div className="border border-primary/30 rounded-lg p-6 bg-card animate-slide-up transition-all hover:border-primary/50">
                <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                  <div className="w-1 h-5 bg-primary rounded-full" />
                  ML Congestion Prediction
                  <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full ml-2">
                    Optional ML Extension
                  </span>
                </h3>
                <p className="text-sm text-muted-foreground mb-6">
                  Machine learning model predicts congestion risk before it happens.
                  Risk scores indicate likelihood of congestion in the next time slot.
                </p>
                <CongestionPrediction />
              </div>
            )}

            {/* 4-5. Topology Mapping + Correlation Heatmap (Figure 1 Equivalent) */}
            <div className="grid lg:grid-cols-2 gap-8">
              {/* 4. Topology Mapping */}
              <div className="border border-border rounded-lg p-6 bg-card animate-slide-up stagger-2 transition-all hover:border-primary/30">
                <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                  <div className="w-1 h-5 bg-primary rounded-full" />
                  Topology Mapping
                  {isLiveMode && (
                    <span className="text-xs text-green-400 ml-2 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                      Live
                    </span>
                  )}
                </h3>
                <p className="text-sm text-muted-foreground mb-6">
                  Cell to Link assignment inferred from correlated congestion events
                </p>
                <TopologyTable cellTopology={currentCellTopology} />
              </div>

              {/* 5. Correlation Heatmap */}
              <div className="border border-border rounded-lg p-6 bg-card animate-slide-up stagger-3 transition-all hover:border-accent/30">
                <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                  <div className="w-1 h-5 bg-accent rounded-full" />
                  Correlation Heatmap
                  {isLiveMode && (
                    <span className="text-xs text-green-400 ml-2 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                      Live
                    </span>
                  )}
                </h3>
                <p className="text-sm text-muted-foreground mb-6">
                  Correlated congestion events used for topology inference (Figure 1)
                </p>
                <CorrelationHeatmap
                  liveCorrelation={isLiveMode && liveAnalysis ? liveAnalysis.correlation_matrix : undefined}
                  liveTopology={isLiveMode && liveAnalysis ? liveAnalysis.topology : undefined}
                />
              </div>
            </div>

            {/* 6. Cell-wise Traffic Analysis */}
            <div className="border border-border rounded-lg p-6 bg-card animate-slide-up stagger-4 transition-all hover:border-primary/30">
              <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <div className="w-1 h-5 bg-primary rounded-full" />
                Cell-wise Traffic Analysis
              </h3>
              <p className="text-sm text-muted-foreground mb-6">
                Synchronized behavior of cells sharing the same link during congestion events.
              </p>

              <Tabs defaultValue="throughput" className="w-full">
                <TabsList className="mb-4">
                  <TabsTrigger value="throughput" className="transition-all">Throughput</TabsTrigger>
                  <TabsTrigger value="packetLoss" className="transition-all">Packet Loss</TabsTrigger>
                </TabsList>
                <TabsContent value="throughput" className="animate-fade-in">
                  <CellTrafficChart mode="throughput" />
                </TabsContent>
                <TabsContent value="packetLoss" className="animate-fade-in">
                  <CellTrafficChart mode="packetLoss" />
                </TabsContent>
              </Tabs>
            </div>

            {/* 7. Aggregated Link Traffic */}
            <div className="border border-border rounded-lg p-6 bg-card animate-slide-up stagger-5 transition-all hover:border-accent/30">
              <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                <div>
                  <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                    <div className="w-1 h-5 bg-accent rounded-full" />
                    Aggregated Link Traffic
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Aggregate traffic of all cells per inferred fronthaul link
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 mb-4">
                <span className="text-sm text-muted-foreground">Shared links:</span>
                {linkData.filter(l => !l.isolated).map((link) => (
                  <label
                    key={link.linkId}
                    className="flex items-center gap-2 cursor-pointer text-sm transition-all hover:scale-105"
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
                    className="flex items-center gap-2 cursor-pointer text-sm transition-all hover:scale-105"
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

            {/* 8. Link Traffic (Per-Slot Resolution) - Figure 3 Equivalent */}
            <div className="border border-border rounded-lg p-6 bg-card animate-slide-up stagger-6 transition-all hover:border-purple-500/30">
              <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <div className="w-1 h-5 bg-purple-500 rounded-full" />
                Link Traffic (Per-Slot Resolution)
                <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded-full ml-2">
                  Figure 3
                </span>
              </h3>
              <p className="text-sm text-muted-foreground mb-6">
                Per-slot data rate over time (60s window). Shows required FH link capacity vs average data rate.
              </p>
              <LinkTrafficVisualization />
            </div>

            {/* 9. Buffer Impact Analysis - Capacity Estimation */}
            <div className="border border-border rounded-lg p-6 bg-card animate-slide-up stagger-7 transition-all hover:border-warning/30">
              <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <div className="w-1 h-5 bg-warning rounded-full" />
                Buffer Impact Analysis
                <span className="text-xs bg-warning/20 text-warning px-2 py-0.5 rounded-full ml-2">
                  4 symbols • 1% loss
                </span>
              </h3>
              <p className="text-sm text-muted-foreground mb-6">
                Capacity estimation with vs without buffer. Buffer size: 4 symbols (143µs), packet loss tolerance: up to 1%.
              </p>
              <BufferAnalysis linkData={linkData} withBuffer={withBuffer} />
            </div>

            {/* 10. Summary Table - Final Consolidated View */}
            <div className="border border-border rounded-lg p-6 bg-card animate-slide-up stagger-8 transition-all hover:border-success/30">
              <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <div className="w-1 h-5 bg-success rounded-full" />
                Summary Table
                <span className="text-xs bg-success/20 text-success px-2 py-0.5 rounded-full ml-2">
                  Final Results
                </span>
                {isLiveMode && (
                  <span className="text-xs text-green-400 ml-2 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                    Live
                  </span>
                )}
              </h3>
              <p className="text-sm text-muted-foreground mb-6">
                Final consolidated view of link capacities and optimization impact
              </p>
              <SummaryTable linkData={linkData} cellTopology={currentCellTopology} />
            </div>
          </div>
        )}

        {/* Empty State */}
        {!analysisRun && (
          <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in">
            <div className="relative mb-6">
              <Network className="w-16 h-16 text-muted-foreground/50" />
              <div className="absolute inset-0 animate-pulse">
                <Network className="w-16 h-16 text-primary/20" />
              </div>
            </div>
            <h3 className="text-xl font-medium text-foreground mb-2">Ready to analyze</h3>
            <p className="text-sm text-muted-foreground max-w-sm mb-4">
              Select a dataset, set buffer option, then Run Analysis to visualize the network topology.
            </p>
            {backendAvailable === true && (
              <div className="flex items-center gap-2 text-sm text-green-400 animate-slide-up">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                Backend online — Live Analysis available
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default Analysis;

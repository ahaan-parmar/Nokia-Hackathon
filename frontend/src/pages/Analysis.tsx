import { useState, useMemo, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Radio, Play, RefreshCw, Moon, Sun, Loader2, AlertCircle, Zap, Network } from "lucide-react";
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
      <header className="border-b border-primary/20 sticky top-0 bg-gradient-to-r from-background via-primary/5 to-background backdrop-blur-md z-50">
        <div className="container mx-auto px-8 py-5 flex items-center justify-between">
          <div className="flex items-center gap-5">
            <div className="p-3 rounded-xl border border-nokia/20 bg-nokia/10">
              <Radio className="w-6 h-6 text-nokia" />
            </div>
            <div className="flex flex-col gap-0.5">
              <h1 className="font-black text-foreground text-2xl tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
                FRONTHAUL NETWORK ANALYZER
              </h1>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground font-medium">by</span>
                <span className="text-sm font-bold text-transparent bg-gradient-to-r from-nokia to-nokia-light bg-clip-text">Team Phish & Chips</span>
                <span className="text-muted-foreground/50">•</span>
                <span className="text-sm text-muted-foreground/80 font-medium">LoveLace Hackathon 2026</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setDarkMode(!darkMode)}
              className="h-10 w-10 transition-all hover:scale-110 hover:bg-primary/10 rounded-xl"
            >
              {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </Button>

            {analysisRun && (
              <Button variant="outline" onClick={handleReset} className="gap-2 transition-all hover:scale-105 border-primary/30 hover:border-primary/50 hover:bg-primary/5 h-10 px-5 rounded-xl font-semibold">
                <RefreshCw className="w-4 h-4" />
                Reset
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        {/* Controls */}
        <div className="border border-nokia/20 rounded-2xl p-8 mb-8 bg-gradient-to-br from-card via-card to-nokia/5 animate-fade-in relative overflow-hidden group">
          {/* Subtle animated background */}
          <div className="absolute inset-0 bg-gradient-to-r from-nokia/5 via-transparent to-nokia/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

          <div className="relative">
            <div className="flex items-center gap-3 mb-8">
              <div className="p-2 rounded-xl bg-nokia/10">
                <Zap className="w-5 h-5 text-nokia" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground">
                  Analysis Configuration
                </h2>
                <p className="text-sm text-muted-foreground">Configure your topology inference analysis</p>
              </div>
            </div>

            <div className="grid lg:grid-cols-3 gap-6">
              {/* Dataset Selection Card */}
              <div className="p-5 rounded-xl bg-background/50 border border-border hover:border-nokia/30 transition-all duration-300 hover:shadow-lg hover:shadow-nokia/5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-3 block">
                  Data Source
                </Label>
                <Select value={selectedDataset} onValueChange={setSelectedDataset}>
                  <SelectTrigger className="bg-background border-border h-12 w-full transition-all hover:border-nokia/50 rounded-xl text-base">
                    <SelectValue placeholder="Select dataset..." />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border rounded-xl">
                    {datasets.map((dataset) => (
                      <SelectItem
                        key={dataset.id}
                        value={dataset.id}
                        className="py-3 transition-colors rounded-lg"
                        disabled={dataset.id === "live-analysis" && backendAvailable === false}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{dataset.name}</span>
                          {dataset.id === "live-analysis" && (
                            <span className={`text-[10px] px-2 py-1 rounded-full font-semibold transition-all ${backendAvailable === true
                              ? "bg-green-500/20 text-green-400"
                              : backendAvailable === false
                                ? "bg-red-500/20 text-red-400"
                                : "bg-yellow-500/20 text-yellow-400"
                              }`}>
                              {backendAvailable === true ? "● Online" : backendAvailable === false ? "● Offline" : "● Checking"}
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedDataset && (
                  <p className="text-xs text-muted-foreground mt-3 leading-relaxed animate-fade-in">
                    {datasets.find(d => d.id === selectedDataset)?.description}
                  </p>
                )}
              </div>

              {/* Buffer Configuration Card */}
              <div className="p-5 rounded-xl bg-background/50 border border-border hover:border-nokia/30 transition-all duration-300 hover:shadow-lg hover:shadow-nokia/5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-3 block">
                  Buffer Mode
                </Label>
                <div
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all duration-300 ${withBuffer
                    ? 'border-nokia bg-nokia/10 shadow-lg shadow-nokia/10'
                    : 'border-border hover:border-muted-foreground/30'
                    }`}
                  onClick={() => setWithBuffer(!withBuffer)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${withBuffer ? 'bg-nokia text-white' : 'bg-muted text-muted-foreground'
                        }`}>
                        <span className="font-bold text-sm">4</span>
                      </div>
                      <div>
                        <div className="font-semibold text-foreground">
                          {withBuffer ? "4-Symbol Buffer" : "No Buffer"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {withBuffer ? "143µs delay, 1% loss tolerance" : "Zero delay, strict capacity"}
                        </div>
                      </div>
                    </div>
                    <Switch
                      checked={withBuffer}
                      onCheckedChange={setWithBuffer}
                      className="data-[state=checked]:bg-nokia"
                    />
                  </div>
                </div>
              </div>

              {/* Run Analysis Card */}
              <div className="p-5 rounded-xl bg-background/50 border border-border hover:border-nokia/30 transition-all duration-300 hover:shadow-lg hover:shadow-nokia/5 flex flex-col justify-between">
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-3 block">
                    Execute
                  </Label>
                  <p className="text-sm text-muted-foreground mb-4">
                    Run topology inference on selected dataset
                  </p>
                </div>
                <Button
                  onClick={handleRunAnalysis}
                  disabled={!selectedDataset || isLoading}
                  className="w-full bg-gradient-to-r from-nokia to-nokia-light text-white hover:from-nokia-dark hover:to-nokia gap-3 h-14 text-base font-semibold transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-nokia/30 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Play className="w-5 h-5" />
                      Run Analysis
                    </>
                  )}
                </Button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-red-400 mt-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 animate-slide-in-right">
                <AlertCircle className="w-5 h-5" />
                {error}
              </div>
            )}
          </div>
        </div>

        {/* Live Data Summary Banner */}
        {analysisRun && isLiveMode && liveSummary && (
          <div className="rounded-2xl p-6 mb-8 bg-card border border-border animate-slide-up">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 rounded-lg bg-nokia/10">
                <Zap className="w-5 h-5 text-nokia" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Live Analysis Complete</h3>
                <p className="text-xs text-muted-foreground">{liveSummary.algorithm} • {liveSummary.data_source}</p>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-xs text-green-500 font-medium">Connected</span>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4">
              <div className="text-center p-4 rounded-xl bg-muted/30">
                <div className="text-3xl font-bold text-foreground mb-1">
                  <AnimatedCounter value={liveSummary.total_data_points} duration={1500} />
                </div>
                <div className="text-xs text-muted-foreground">Data Points</div>
              </div>
              <div className="text-center p-4 rounded-xl bg-muted/30">
                <div className="text-3xl font-bold text-foreground mb-1">
                  <AnimatedCounter value={liveSummary.total_cells} duration={800} />
                </div>
                <div className="text-xs text-muted-foreground">Cells</div>
              </div>
              <div className="text-center p-4 rounded-xl bg-muted/30">
                <div className="text-3xl font-bold text-nokia mb-1">
                  <AnimatedCounter value={liveSummary.inferred_links} duration={800} />
                </div>
                <div className="text-xs text-muted-foreground">Links Inferred</div>
              </div>
              <div className="text-center p-4 rounded-xl bg-muted/30">
                <div className="text-3xl font-bold text-foreground mb-1">
                  <AnimatedCounter value={liveSummary.congestion_events} duration={1200} />
                </div>
                <div className="text-xs text-muted-foreground">Congestion Events</div>
              </div>
            </div>
          </div>
        )}

        {/* Results */}
        {analysisRun && (
          <div className="flex gap-6">
            {/* Main Content */}
            <div className="flex-1 space-y-8 min-w-0">
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

              {/* 6-7. Traffic Analysis (Combined Tabs) */}
              <div className="border border-border rounded-lg p-6 bg-card animate-slide-up stagger-4 transition-all hover:border-primary/30">
                <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                  <div className="w-1 h-5 bg-primary rounded-full" />
                  Traffic Analysis
                </h3>
                <p className="text-sm text-muted-foreground mb-6">
                  Analyze traffic patterns at cell level and aggregated link level.
                </p>

                <Tabs defaultValue="cell-throughput" className="w-full">
                  <TabsList className="mb-4">
                    <TabsTrigger value="cell-throughput" className="transition-all">Cell Throughput</TabsTrigger>
                    <TabsTrigger value="cell-packetloss" className="transition-all">Cell Packet Loss</TabsTrigger>
                    <TabsTrigger value="link-traffic" className="transition-all">Aggregated Links</TabsTrigger>
                  </TabsList>
                  <TabsContent value="cell-throughput" className="animate-fade-in">
                    <p className="text-xs text-muted-foreground mb-4">Synchronized behavior of cells sharing the same link during congestion events.</p>
                    <CellTrafficChart mode="throughput" />
                  </TabsContent>
                  <TabsContent value="cell-packetloss" className="animate-fade-in">
                    <p className="text-xs text-muted-foreground mb-4">Packet loss correlation reveals shared infrastructure.</p>
                    <CellTrafficChart mode="packetLoss" />
                  </TabsContent>
                  <TabsContent value="link-traffic" className="animate-fade-in">
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
                  </TabsContent>
                </Tabs>
              </div>

              {/* 8. Link Traffic (Per-Slot Resolution) - Figure 3 Equivalent */}
              <div className="border border-border rounded-lg p-6 bg-card animate-slide-up stagger-5 transition-all hover:border-purple-500/30">
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
              <div className="border border-border rounded-lg p-6 bg-card animate-slide-up stagger-6 transition-all hover:border-warning/30">
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
            </div>

            {/* Sticky Sidebar - Summary Table */}
            <div className="hidden xl:block w-80 flex-shrink-0">
              <div className="sticky top-24 space-y-4">
                <div className="border border-success/30 rounded-lg p-4 bg-card animate-slide-up transition-all hover:border-success/50">
                  <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                    <div className="w-1 h-4 bg-success rounded-full" />
                    Summary Table
                    <span className="text-[10px] bg-success/20 text-success px-1.5 py-0.5 rounded-full ml-auto">
                      Final Results
                    </span>
                  </h3>
                  <div className="max-h-[calc(100vh-180px)] overflow-y-auto">
                    <SummaryTable linkData={linkData} cellTopology={currentCellTopology} />
                  </div>
                </div>
              </div>
            </div>

            {/* Mobile Summary Table (shown below on smaller screens) */}
            <div className="xl:hidden border border-border rounded-lg p-6 bg-card animate-slide-up transition-all hover:border-success/30">
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

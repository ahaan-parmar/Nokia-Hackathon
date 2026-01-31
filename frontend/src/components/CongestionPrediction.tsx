import { useState, useEffect, useRef } from "react";
import { AlertTriangle, TrendingUp, Brain, Activity, RefreshCw, Loader2, Play, Pause, RotateCcw, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getPredictions,
  getModelInfo,
  getLiveStream,
  type PredictionResult,
  type ModelInfo,
  type LiveCell,
} from "@/services/api";

// Risk category colors
const riskColors = {
  Critical: { bg: "bg-red-500/20", text: "text-red-400", border: "border-red-500/50" },
  High: { bg: "bg-orange-500/20", text: "text-orange-400", border: "border-orange-500/50" },
  Medium: { bg: "bg-yellow-500/20", text: "text-yellow-400", border: "border-yellow-500/50" },
  Low: { bg: "bg-green-500/20", text: "text-green-400", border: "border-green-500/50" },
};

// Risk bar component
function RiskBar({ score }: { score: number }) {
  const percentage = Math.round(score * 100);
  const color = score >= 0.75 ? "bg-red-500" : score >= 0.5 ? "bg-orange-500" : score >= 0.25 ? "bg-yellow-500" : "bg-green-500";
  
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
        <div className={`h-full ${color} transition-all duration-200`} style={{ width: `${percentage}%` }} />
      </div>
      <span className="text-xs font-mono w-12 text-right">{percentage}%</span>
    </div>
  );
}

export function CongestionPrediction() {
  // Static data state
  const [predictions, setPredictions] = useState<PredictionResult | null>(null);
  const [modelInfo, setModelInfo] = useState<ModelInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Live streaming state
  const [isLive, setIsLive] = useState(false);
  const [liveCells, setLiveCells] = useState<LiveCell[]>([]);
  const [liveProgress, setLiveProgress] = useState(0);
  const [liveTimestamp, setLiveTimestamp] = useState(0);
  const [totalTimestamps, setTotalTimestamps] = useState(0);
  const [streamSpeed, setStreamSpeed] = useState(500);
  
  const intervalRef = useRef<number | null>(null);
  const isFetchingRef = useRef(false);

  // Fetch initial static data
  const fetchStaticData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [predData, modelData] = await Promise.all([
        getPredictions(),
        getModelInfo(),
      ]);
      setPredictions(predData);
      setModelInfo(modelData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load predictions");
    } finally {
      setLoading(false);
    }
  };

  // Fetch next live data
  const fetchLiveData = async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    
    try {
      const result = await getLiveStream('next', 5);
      
      if (result.timeline && result.timeline.length > 0) {
        const latest = result.timeline[result.timeline.length - 1];
        setLiveCells(latest.cells);
        setLiveTimestamp(latest.timestamp);
        setLiveProgress(result.pagination.progress);
        setTotalTimestamps(result.pagination.totalTimestamps);
      }
    } catch (err) {
      console.error("Live fetch error:", err);
    } finally {
      isFetchingRef.current = false;
    }
  };

  // Start live streaming
  const startLive = async () => {
    setIsLive(true);
    await fetchLiveData(); // Immediate first fetch
  };

  // Stop live streaming  
  const stopLive = () => {
    setIsLive(false);
  };

  // Reset stream
  const resetStream = async () => {
    stopLive();
    try {
      await getLiveStream('reset');
      setLiveCells([]);
      setLiveProgress(0);
      setLiveTimestamp(0);
    } catch (err) {
      console.error("Reset error:", err);
    }
  };

  // Manage polling interval
  useEffect(() => {
    if (isLive) {
      // Start polling
      intervalRef.current = window.setInterval(fetchLiveData, streamSpeed);
      return () => {
        if (intervalRef.current) {
          window.clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      };
    } else {
      // Stop polling
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
  }, [isLive, streamSpeed]);

  // Load initial data
  useEffect(() => {
    fetchStaticData();
  }, []);

  // Determine what to display
  const displayCells = isLive && liveCells.length > 0 ? liveCells : predictions?.predictions || [];
  
  // Calculate summary
  const summary = {
    critical: displayCells.filter(c => c.riskCategory === 'Critical').length,
    high: displayCells.filter(c => c.riskCategory === 'High').length,
    medium: displayCells.filter(c => c.riskCategory === 'Medium').length,
    low: displayCells.filter(c => c.riskCategory === 'Low').length,
    congested: displayCells.filter(c => 'isCongested' in c ? c.isCongested : ('currentPacketLoss' in c && c.currentPacketLoss > 0)).length,
  };

  if (loading && !predictions) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-3 text-muted-foreground">Loading ML predictions...</span>
      </div>
    );
  }

  if (error && !predictions) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <AlertTriangle className="w-12 h-12 text-orange-400 mb-4" />
        <p className="text-muted-foreground mb-4">{error}</p>
        <Button onClick={fetchStaticData} variant="outline" className="gap-2">
          <RefreshCw className="w-4 h-4" />
          Retry
        </Button>
      </div>
    );
  }

  const bestModel = modelInfo?.models?.gradient_boosting;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${isLive ? 'bg-green-500/20' : 'bg-primary/10'}`}>
            {isLive ? <Radio className="w-5 h-5 text-green-400 animate-pulse" /> : <Brain className="w-5 h-5 text-primary" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-medium text-foreground">Gradient Boosting</h4>
              {isLive && (
                <span className="flex items-center gap-1 text-green-400 text-xs">
                  <span className="w-2 h-2 rounded-full bg-green-400 animate-ping" />
                  LIVE
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {bestModel && `ROC-AUC: ${(bestModel.roc_auc * 100).toFixed(1)}%`}
              {isLive && ` | Time: ${liveTimestamp.toFixed(2)}s | Progress: ${liveProgress.toFixed(1)}%`}
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3">
          <select 
            value={streamSpeed}
            onChange={(e) => setStreamSpeed(Number(e.target.value))}
            className="bg-secondary border border-border rounded px-2 py-1 text-xs"
            disabled={isLive}
          >
            <option value={1000}>1x</option>
            <option value={500}>2x</option>
            <option value={250}>4x</option>
            <option value={100}>10x</option>
          </select>

          <Button 
            onClick={isLive ? stopLive : startLive}
            variant={isLive ? "destructive" : "default"}
            size="sm"
            className="gap-2"
          >
            {isLive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            {isLive ? 'Stop' : 'Start Live'}
          </Button>

          <Button onClick={resetStream} variant="outline" size="sm" disabled={isLive}>
            <RotateCcw className="w-4 h-4" />
          </Button>

          <Button onClick={fetchStaticData} variant="outline" size="sm" disabled={loading || isLive}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Progress bar */}
      {isLive && (
        <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
          <div 
            className="h-full bg-green-500 transition-all duration-200"
            style={{ width: `${liveProgress}%` }}
          />
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-5 gap-3">
        <div className={`rounded-lg p-3 ${riskColors.Critical.bg} border ${riskColors.Critical.border}`}>
          <div className="flex items-center gap-1 mb-1">
            <AlertTriangle className={`w-3 h-3 ${riskColors.Critical.text}`} />
            <span className="text-xs">Critical</span>
          </div>
          <div className={`text-xl font-bold ${riskColors.Critical.text}`}>{summary.critical}</div>
        </div>
        
        <div className={`rounded-lg p-3 ${riskColors.High.bg} border ${riskColors.High.border}`}>
          <div className="flex items-center gap-1 mb-1">
            <TrendingUp className={`w-3 h-3 ${riskColors.High.text}`} />
            <span className="text-xs">High</span>
          </div>
          <div className={`text-xl font-bold ${riskColors.High.text}`}>{summary.high}</div>
        </div>
        
        <div className={`rounded-lg p-3 ${riskColors.Medium.bg} border ${riskColors.Medium.border}`}>
          <div className="flex items-center gap-1 mb-1">
            <Activity className={`w-3 h-3 ${riskColors.Medium.text}`} />
            <span className="text-xs">Medium</span>
          </div>
          <div className={`text-xl font-bold ${riskColors.Medium.text}`}>{summary.medium}</div>
        </div>
        
        <div className={`rounded-lg p-3 ${riskColors.Low.bg} border ${riskColors.Low.border}`}>
          <div className="flex items-center gap-1 mb-1">
            <Activity className={`w-3 h-3 ${riskColors.Low.text}`} />
            <span className="text-xs">Low</span>
          </div>
          <div className={`text-xl font-bold ${riskColors.Low.text}`}>{summary.low}</div>
        </div>

        <div className={`rounded-lg p-3 bg-red-500/30 border border-red-500/50`}>
          <div className="flex items-center gap-1 mb-1">
            <AlertTriangle className="w-3 h-3 text-red-400" />
            <span className="text-xs">Congested</span>
          </div>
          <div className="text-xl font-bold text-red-400">{summary.congested}</div>
        </div>
      </div>

      {/* Cell Table */}
      <div className="rounded-lg border border-border overflow-hidden">
        <div className="bg-secondary/50 px-4 py-2 border-b border-border flex justify-between items-center">
          <span className="text-sm font-medium">Cell Risk Rankings</span>
          {isLive && <span className="text-xs text-green-400">Updating every {streamSpeed}ms</span>}
        </div>
        <div className="max-h-[350px] overflow-y-auto">
          <table className="w-full">
            <thead className="sticky top-0 bg-background text-xs text-muted-foreground">
              <tr className="border-b border-border">
                <th className="text-left px-4 py-2">Cell</th>
                <th className="text-left px-4 py-2 w-36">Risk</th>
                <th className="text-left px-4 py-2">Status</th>
                <th className="text-right px-4 py-2">Throughput</th>
                <th className="text-right px-4 py-2">Loss</th>
              </tr>
            </thead>
            <tbody>
              {displayCells.map((cell) => {
                const colors = riskColors[cell.riskCategory];
                const throughput = 'currentThroughput' in cell ? cell.currentThroughput : ('throughput' in cell ? cell.throughput : 0);
                const loss = 'currentPacketLoss' in cell ? cell.currentPacketLoss : ('packetLoss' in cell ? cell.packetLoss : 0);
                const congested = 'isCongested' in cell ? cell.isCongested : loss > 0;
                
                return (
                  <tr key={cell.cellId} className={`border-b border-border/50 hover:bg-secondary/30 ${congested ? 'bg-red-500/10' : ''}`}>
                    <td className="px-4 py-2 font-mono text-sm">{cell.cellId}</td>
                    <td className="px-4 py-2">
                      <RiskBar score={cell.riskScore} />
                    </td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-0.5 rounded text-xs ${colors.bg} ${colors.text}`}>
                        {cell.riskCategory}
                      </span>
                      {congested && (
                        <span className="ml-2 px-1.5 py-0.5 rounded text-xs bg-red-500/30 text-red-400 animate-pulse">
                          CONGESTED
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-sm">{throughput.toFixed(0)}</td>
                    <td className="px-4 py-2 text-right font-mono text-sm">
                      {loss > 0 ? <span className="text-red-400">{loss}</span> : <span className="text-green-400">0</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

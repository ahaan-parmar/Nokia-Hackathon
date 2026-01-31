/**
 * API Service for fetching data from the backend
 */

const API_BASE = "http://localhost:8000";

export interface CellStat {
  cellId: string;
  linkId: number;
  linkName: string;
  avgThroughput: number;
  peakThroughput: number;
  packetLossRate: number;
  congestionEvents: number;
  totalSamples: number;
  isolated: boolean;
}

export interface LinkStat {
  linkId: number;
  linkName: string;
  cells: string[];
  cellCount: number;
  avgThroughput: number;
  peakThroughput: number;
  packetLossRate: number;
  congestionEvents: number;
  isolated: boolean;
}

export interface AnalysisResult {
  topology: Record<string, string>;
  correlation_matrix: Record<string, Record<string, number>>;
  summary: {
    total_cells: number;
    inferred_links: number;
    congestion_events: number;
    total_data_points: number;
    data_source: string;
    algorithm: string;
  };
}

export interface TimeseriesPoint {
  time: number;
  throughput: number;
  packetLoss: number;
  congested: boolean;
}

export interface TimeseriesResult {
  cellId: string;
  totalPoints: number;
  sampledPoints: number;
  sampleRate: number;
  data: TimeseriesPoint[];
}

/**
 * Check if backend is available
 */
export async function checkBackendHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/health`, { 
      method: 'GET',
      signal: AbortSignal.timeout(3000)
    });
    const data = await response.json();
    return data.status === "ok";
  } catch {
    return false;
  }
}

/**
 * Run full analysis pipeline on backend
 */
export async function runAnalysis(): Promise<AnalysisResult> {
  const response = await fetch(`${API_BASE}/analyze`);
  if (!response.ok) {
    throw new Error(`Analysis failed: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Get statistics for all cells
 */
export async function getCellStats(): Promise<CellStat[]> {
  const response = await fetch(`${API_BASE}/api/cell-stats`);
  if (!response.ok) {
    throw new Error(`Failed to fetch cell stats: ${response.statusText}`);
  }
  const data = await response.json();
  return data.cells;
}

/**
 * Get statistics for all links
 */
export async function getLinkStats(): Promise<LinkStat[]> {
  const response = await fetch(`${API_BASE}/api/link-stats`);
  if (!response.ok) {
    throw new Error(`Failed to fetch link stats: ${response.statusText}`);
  }
  const data = await response.json();
  return data.links;
}

/**
 * Get correlation matrix
 */
export async function getCorrelation(): Promise<{
  correlation_matrix: Record<string, Record<string, number>>;
  topology: Record<string, string>;
}> {
  const response = await fetch(`${API_BASE}/api/correlation`);
  if (!response.ok) {
    throw new Error(`Failed to fetch correlation: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Get time series data for a specific cell
 */
export async function getCellTimeseries(cellId: string): Promise<TimeseriesResult> {
  const response = await fetch(`${API_BASE}/api/timeseries/${cellId}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch timeseries: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Get congestion timeline
 */
export async function getCongestionTimeline(): Promise<{
  timeline: Array<{ time: number; cells: Record<string, number> }>;
  topology: Record<string, string>;
}> {
  const response = await fetch(`${API_BASE}/api/congestion-timeline`);
  if (!response.ok) {
    throw new Error(`Failed to fetch congestion timeline: ${response.statusText}`);
  }
  return response.json();
}

// =============================================================================
// ML CONGESTION PREDICTION APIs
// =============================================================================

export interface CellPrediction {
  cellId: string;
  riskScore: number;
  riskCategory: "Low" | "Medium" | "High" | "Critical";
  currentThroughput: number;
  currentPacketLoss: number;
}

export interface PredictionResult {
  model: string;
  predictionHorizon: string;
  predictions: CellPrediction[];
  summary: {
    totalCells: number;
    criticalRisk: number;
    highRisk: number;
    mediumRisk: number;
    lowRisk: number;
  };
}

export interface ModelInfo {
  source: string;
  models: Record<string, {
    accuracy: number;
    precision: number;
    recall: number;
    f1_score: number;
    roc_auc: number;
  }>;
  best_model: string;
  best_model_name?: string;
  features_used: number;
}

export interface FeatureImportance {
  source: string;
  model: string;
  features: Record<string, number>;
  descriptions?: Record<string, string>;
}

export interface RiskStreamPoint {
  bucket: number;
  time: number;
  avgRisk: number;
  maxRisk: number;
  minRisk: number;
  stdRisk: number;
  criticalCount: number;
  highRiskCount: number;
  dataPoints: number;
  avgThroughput: number;
  totalPacketLoss: number;
}

export interface RiskStreamResult {
  model: string;
  stream: RiskStreamPoint[];
  summary: {
    totalBuckets: number;
    timeRange: number;
    bucketSize: number;
    overallAvgRisk: number;
    overallMaxRisk: number;
  };
}

/**
 * Get congestion predictions for all cells
 */
export async function getPredictions(): Promise<PredictionResult> {
  const response = await fetch(`${API_BASE}/api/predict-congestion`);
  if (!response.ok) {
    throw new Error(`Failed to fetch predictions: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Get ML model information and metrics
 */
export async function getModelInfo(): Promise<ModelInfo> {
  const response = await fetch(`${API_BASE}/api/model-info`);
  if (!response.ok) {
    throw new Error(`Failed to fetch model info: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Get feature importance from the best model
 */
export async function getFeatureImportance(): Promise<FeatureImportance> {
  const response = await fetch(`${API_BASE}/api/feature-importance`);
  if (!response.ok) {
    throw new Error(`Failed to fetch feature importance: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Get risk stream over time (for charts)
 */
export async function getRiskStream(buckets: number = 50): Promise<RiskStreamResult> {
  const response = await fetch(`${API_BASE}/api/risk-stream?buckets=${buckets}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch risk stream: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Get detailed risk for a specific cell
 */
export async function getCellRisk(cellId: string): Promise<{
  cellId: string;
  model: string;
  currentRisk: { score: number; category: string };
  riskTimeline: Array<{ time: number; riskScore: number; throughput: number; packetLoss: number }>;
  statistics: {
    totalDataPoints: number;
    avgRiskScore: number;
    maxRiskScore: number;
    highRiskPeriods: number;
  };
}> {
  const response = await fetch(`${API_BASE}/api/cell-risk/${cellId}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch cell risk: ${response.statusText}`);
  }
  return response.json();
}

// =============================================================================
// LIVE STREAMING APIs
// =============================================================================

export interface LiveCell {
  cellId: string;
  riskScore: number;
  riskCategory: "Low" | "Medium" | "High" | "Critical";
  throughput: number;
  packetLoss: number;
  isCongested: boolean;
}

export interface LiveTimepoint {
  timestamp: number;
  relativeTime: number;
  cells: LiveCell[];
  summary: {
    maxRisk: number;
    avgRisk: number;
    criticalCount: number;
    highRiskCount: number;
    congestedCount: number;
    totalCells: number;
  };
}

export interface LiveStreamResult {
  status: string;
  timeline: LiveTimepoint[];
  pagination: {
    startIndex: number;
    endIndex: number;
    step: number;
    totalTimestamps: number;
    progress: number;
    hasMore: boolean;
  };
  batchSummary: {
    avgRisk: number;
    maxRisk: number;
    totalDataPoints: number;
  };
}

export interface LiveSnapshotResult {
  timestamp: number;
  index: number;
  totalTimestamps: number;
  progress: number;
  cells: LiveCell[];
  summary: {
    criticalCount: number;
    highRiskCount: number;
    mediumRiskCount: number;
    lowRiskCount: number;
    congestedCount: number;
  };
}

/**
 * Get next batch of live stream data
 */
export async function getLiveStream(action: 'next' | 'start' | 'stop' | 'reset' | 'status' = 'next', step: number = 10): Promise<LiveStreamResult> {
  const response = await fetch(`${API_BASE}/api/live-stream?action=${action}&step=${step}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch live stream: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Get current snapshot at specific index
 */
export async function getLiveSnapshot(index?: number): Promise<LiveSnapshotResult> {
  const url = index !== undefined 
    ? `${API_BASE}/api/live-snapshot?index=${index}`
    : `${API_BASE}/api/live-snapshot`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch snapshot: ${response.statusText}`);
  }
  return response.json();
}

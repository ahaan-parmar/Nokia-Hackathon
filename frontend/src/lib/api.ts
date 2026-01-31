/**
 * API Service for 5G Fronthaul Analysis Backend
 * Connects frontend to Flask backend endpoints
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

// ===== Types =====

export interface CellData {
    cellId: string;
    linkId: number;
    linkName: string;
    isolated: boolean;
}

export interface LinkData {
    linkId: number;
    linkName: string;
    cells: string[];
    capacityNoBuffer: number;
    capacityWithBuffer: number;
    reductionPercent: number;
    isolated: boolean;
}

export interface CorrelationMatrix {
    [cellId: string]: {
        [otherCellId: string]: number;
    };
}

export interface TopologyResponse {
    topology: Record<string, string>;
    cells: CellData[];
    links: Record<string, string[]>;
    correlation_matrix: CorrelationMatrix;
    summary: {
        total_cells: number;
        total_links: number;
        shared_links: number;
        isolated_cells: number;
    };
}

export interface CapacityResponse {
    links: LinkData[];
    summary: {
        totalCapacityNoBuffer: number;
        totalCapacityWithBuffer: number;
        totalSavings: number;
        savingsPercent: number;
        bufferSymbols: number;
        lossTolerance: number;
    };
}

export interface FullAnalysisResponse {
    cells: CellData[];
    links: LinkData[];
    correlationMatrix: CorrelationMatrix;
    summary: {
        totalCells: number;
        totalLinks: number;
        sharedLinks: number;
        isolatedCells: number;
        totalCapacityNoBuffer: number;
        totalCapacityWithBuffer: number;
        totalSavings: number;
        savingsPercent: number;
        bufferSymbols: number;
        lossTolerance: number;
    };
}

export interface HealthResponse {
    status: string;
}

export interface ApiError {
    error: string;
    detail: string;
}

// ===== API Functions =====

/**
 * Check backend health status
 */
export async function checkHealth(): Promise<HealthResponse> {
    const response = await fetch(`${API_BASE_URL}/health`);
    if (!response.ok) {
        throw new Error("Backend health check failed");
    }
    return response.json();
}

/**
 * Get topology inference results (Eval-1)
 */
export async function getTopology(): Promise<TopologyResponse> {
    const response = await fetch(`${API_BASE_URL}/api/topology`);
    if (!response.ok) {
        const errorData: ApiError = await response.json();
        throw new Error(errorData.detail || "Failed to get topology");
    }
    return response.json();
}

/**
 * Get capacity estimation results (Eval-2)
 */
export async function getCapacity(options?: {
    bufferSymbols?: number;
    lossTolerance?: number;
}): Promise<CapacityResponse> {
    const params = new URLSearchParams();
    if (options?.bufferSymbols !== undefined) {
        params.set("buffer_symbols", options.bufferSymbols.toString());
    }
    if (options?.lossTolerance !== undefined) {
        params.set("loss_tolerance", options.lossTolerance.toString());
    }

    const url = `${API_BASE_URL}/api/capacity${params.toString() ? `?${params}` : ""}`;
    const response = await fetch(url);

    if (!response.ok) {
        const errorData: ApiError = await response.json();
        throw new Error(errorData.detail || "Failed to get capacity");
    }
    return response.json();
}

/**
 * Get full analysis results (Topology + Capacity)
 */
export async function getFullAnalysis(options?: {
    bufferSymbols?: number;
    lossTolerance?: number;
}): Promise<FullAnalysisResponse> {
    const params = new URLSearchParams();
    if (options?.bufferSymbols !== undefined) {
        params.set("buffer_symbols", options.bufferSymbols.toString());
    }
    if (options?.lossTolerance !== undefined) {
        params.set("loss_tolerance", options.lossTolerance.toString());
    }

    const url = `${API_BASE_URL}/api/full-analysis${params.toString() ? `?${params}` : ""}`;
    const response = await fetch(url);

    if (!response.ok) {
        const errorData: ApiError = await response.json();
        throw new Error(errorData.detail || "Failed to run analysis");
    }
    return response.json();
}

/**
 * Legacy analyze endpoint (Eval-1 only)
 */
export async function runAnalyze(): Promise<{
    topology: Record<string, string>;
    correlation_matrix: CorrelationMatrix;
    summary: {
        total_cells: number;
        inferred_links: number;
        data_source: string;
    };
}> {
    const response = await fetch(`${API_BASE_URL}/analyze`);
    if (!response.ok) {
        const errorData: ApiError = await response.json();
        throw new Error(errorData.detail || "Analysis failed");
    }
    return response.json();
}

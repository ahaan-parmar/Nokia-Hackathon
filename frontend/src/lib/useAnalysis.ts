import { useState, useCallback } from "react";
import {
    getFullAnalysis,
    checkHealth,
    FullAnalysisResponse
} from "@/lib/api";

export interface UseAnalysisOptions {
    bufferSymbols?: number;
    lossTolerance?: number;
}

export interface UseAnalysisResult {
    data: FullAnalysisResponse | null;
    loading: boolean;
    error: string | null;
    isBackendAvailable: boolean;
    runAnalysis: (options?: UseAnalysisOptions) => Promise<void>;
    checkBackend: () => Promise<boolean>;
    reset: () => void;
}

export function useAnalysis(): UseAnalysisResult {
    const [data, setData] = useState<FullAnalysisResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isBackendAvailable, setIsBackendAvailable] = useState(false);

    const checkBackend = useCallback(async (): Promise<boolean> => {
        try {
            await checkHealth();
            setIsBackendAvailable(true);
            return true;
        } catch {
            setIsBackendAvailable(false);
            return false;
        }
    }, []);

    const runAnalysis = useCallback(async (options?: UseAnalysisOptions) => {
        setLoading(true);
        setError(null);

        try {
            const result = await getFullAnalysis({
                bufferSymbols: options?.bufferSymbols ?? 4,
                lossTolerance: options?.lossTolerance ?? 0.01,
            });
            setData(result);
        } catch (err) {
            const message = err instanceof Error ? err.message : "Analysis failed";
            setError(message);
        } finally {
            setLoading(false);
        }
    }, []);

    const reset = useCallback(() => {
        setData(null);
        setError(null);
        setLoading(false);
    }, []);

    return {
        data,
        loading,
        error,
        isBackendAvailable,
        runAnalysis,
        checkBackend,
        reset,
    };
}

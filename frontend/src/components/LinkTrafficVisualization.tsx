import { useState, useEffect, useCallback } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    ReferenceLine,
    Legend,
} from "recharts";

interface LinkInfo {
    linkId: number;
    linkName: string;
    cells: string[];
    cellCount: number;
}

interface TrafficDataPoint {
    time: number;
    gbps: number;
}

interface LinkTrafficData {
    linkId: number;
    cells: string[];
    averageGbps: number;
    peakGbps: number;
    totalSlots: number;
    durationSeconds: number;
    data: TrafficDataPoint[];
}

export function LinkTrafficVisualization() {
    const [links, setLinks] = useState<LinkInfo[]>([]);
    const [selectedLink, setSelectedLink] = useState<number | null>(null);
    const [trafficData, setTrafficData] = useState<LinkTrafficData | null>(null);
    const [loading, setLoading] = useState(false);
    const [linksLoading, setLinksLoading] = useState(true);
    const [duration, setDuration] = useState(60);

    // Fetch available links
    useEffect(() => {
        const fetchLinks = async () => {
            try {
                const response = await fetch("http://localhost:8000/api/all-links-info");
                const data = await response.json();
                if (data.links && data.links.length > 0) {
                    setLinks(data.links);
                    setSelectedLink(data.links[0].linkId);
                }
            } catch (error) {
                console.error("Error fetching links:", error);
            } finally {
                setLinksLoading(false);
            }
        };
        fetchLinks();
    }, []);

    // Fetch traffic data for selected link
    const fetchTrafficData = useCallback(async () => {
        if (selectedLink === null) return;

        setLoading(true);
        try {
            const response = await fetch(
                `http://localhost:8000/api/link-traffic/${selectedLink}?duration=${duration}`
            );
            const data = await response.json();
            if (data.data && data.data.length > 0) {
                setTrafficData(data);
            }
        } catch (error) {
            console.error("Error fetching traffic data:", error);
        } finally {
            setLoading(false);
        }
    }, [selectedLink, duration]);

    useEffect(() => {
        fetchTrafficData();
    }, [fetchTrafficData]);

    // Sample data for display (reduce points for performance)
    const sampleData = trafficData?.data
        ? trafficData.data.filter((_, index) => index % Math.max(1, Math.floor(trafficData.data.length / 1000)) === 0)
        : [];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="border rounded-lg bg-card shadow-sm">
                <div className="p-4 border-b">
                    <h3 className="text-lg font-semibold text-foreground">Link Traffic Analysis (Figure 3)</h3>
                    <p className="text-sm text-muted-foreground">
                        Data rate per slot over time - Select a link to view traffic pattern
                    </p>
                </div>
                <div className="p-4">
                    <div className="flex flex-wrap items-end gap-6">
                        {/* Link Selector */}
                        <div className="space-y-2">
                            <Label>Select Link</Label>
                            {linksLoading ? (
                                <div className="text-sm text-muted-foreground">Loading links...</div>
                            ) : (
                                <Select
                                    value={selectedLink?.toString() || ""}
                                    onValueChange={(value) => setSelectedLink(parseInt(value))}
                                >
                                    <SelectTrigger className="w-[200px]">
                                        <SelectValue placeholder="Select a link" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {links.map((link) => (
                                            <SelectItem key={link.linkId} value={link.linkId.toString()}>
                                                Link {link.linkId} ({link.cellCount} cells)
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                        </div>

                        {/* Duration Selector */}
                        <div className="space-y-2">
                            <Label>Duration (seconds)</Label>
                            <Select
                                value={duration.toString()}
                                onValueChange={(value) => setDuration(parseInt(value))}
                            >
                                <SelectTrigger className="w-[150px]">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="10">10 seconds</SelectItem>
                                    <SelectItem value="30">30 seconds</SelectItem>
                                    <SelectItem value="60">60 seconds</SelectItem>
                                    <SelectItem value="82">Full (~82s)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Stats Display */}
                        {trafficData && (
                            <div className="flex gap-4 ml-auto">
                                <div className="text-center px-4 py-2 bg-purple-500/20 rounded">
                                    <div className="text-xs text-muted-foreground">Average</div>
                                    <div className="font-semibold text-purple-400">
                                        {trafficData.averageGbps.toFixed(2)} Gbps
                                    </div>
                                </div>
                                <div className="text-center px-4 py-2 bg-red-500/20 rounded">
                                    <div className="text-xs text-muted-foreground">Peak</div>
                                    <div className="font-semibold text-red-400">
                                        {trafficData.peakGbps.toFixed(2)} Gbps
                                    </div>
                                </div>
                                <div className="text-center px-4 py-2 bg-blue-500/20 rounded">
                                    <div className="text-xs text-muted-foreground">Cells</div>
                                    <div className="font-semibold text-blue-400">
                                        {trafficData.cells.join(", ")}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Chart */}
            <div className="border rounded-lg bg-card shadow-sm">
                <div className="p-4 border-b">
                    <h4 className="font-medium text-foreground">
                        {selectedLink !== null ? `Link ${selectedLink} Traffic` : "Select a link"}
                    </h4>
                </div>
                <div className="p-4">
                    {loading ? (
                        <div className="h-[400px] flex items-center justify-center text-muted-foreground">
                            Loading traffic data...
                        </div>
                    ) : trafficData && sampleData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={400}>
                            <AreaChart data={sampleData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                                <XAxis
                                    dataKey="time"
                                    label={{ value: "Time (seconds)", position: "insideBottom", offset: -10 }}
                                    tickFormatter={(value) => value.toFixed(0)}
                                />
                                <YAxis
                                    label={{ value: "Data Rate (Gbps)", angle: -90, position: "insideLeft" }}
                                    domain={[0, "auto"]}
                                />
                                <Tooltip
                                    formatter={(value: number) => [`${value.toFixed(4)} Gbps`, "Data Rate"]}
                                    labelFormatter={(label) => `Time: ${Number(label).toFixed(3)}s`}
                                />
                                <Legend verticalAlign="top" height={36} />

                                {/* Traffic Area */}
                                <Area
                                    type="stepAfter"
                                    dataKey="gbps"
                                    name="Data Rate"
                                    stroke="#7c3aed"
                                    fill="#7c3aed"
                                    fillOpacity={0.6}
                                />

                                {/* Peak Capacity Line (Red Dashed) */}
                                <ReferenceLine
                                    y={trafficData.peakGbps}
                                    stroke="#ef4444"
                                    strokeDasharray="8 4"
                                    strokeWidth={2}
                                    label={{
                                        value: `Peak: ${trafficData.peakGbps.toFixed(2)} Gbps`,
                                        position: "right",
                                        fill: "#ef4444",
                                        fontSize: 12,
                                    }}
                                />

                                {/* Average Line (Green Dashed) */}
                                <ReferenceLine
                                    y={trafficData.averageGbps}
                                    stroke="#22c55e"
                                    strokeDasharray="5 3"
                                    strokeWidth={2}
                                    label={{
                                        value: `Avg: ${trafficData.averageGbps.toFixed(2)} Gbps`,
                                        position: "right",
                                        fill: "#22c55e",
                                        fontSize: 12,
                                    }}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-[400px] flex items-center justify-center text-muted-foreground">
                            No traffic data available
                        </div>
                    )}
                </div>
            </div>

            {/* Info */}
            {trafficData && (
                <div className="text-sm text-muted-foreground bg-muted p-4 rounded-lg">
                    <strong>Chart Info:</strong> Showing {sampleData.length.toLocaleString()} sampled points from{" "}
                    {trafficData.totalSlots?.toLocaleString() || 'N/A'} total slots.
                    Total duration: {trafficData.durationSeconds?.toFixed(2) || duration}s.
                </div>
            )}
        </div>
    );
}

export default LinkTrafficVisualization;

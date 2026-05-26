import type {
  AiDiagnosticsResponse,
  ComponentType,
  ConnectionComponent,
  ConnectionIncident,
  ConnectionLogEntry,
  ConnectionStatus,
  DependencyMapResponse,
  HeartbeatMonitorRow,
  LatencyPoint,
  PacketLossPoint
} from "../types/connection-health.types";

function isoNow(offsetSeconds = 0) {
  return new Date(Date.now() + offsetSeconds * 1000).toISOString();
}

export function createMockComponents(): ConnectionComponent[] {
  return [];
}

export function createMockDependencyMap(_components: ConnectionComponent[]): DependencyMapResponse {
  return {
    meta: { timestamp: isoNow() },
    nodes: [],
    edges: [],
    firstFailedComponentId: null,
    downstreamImpactedComponentIds: [],
    tradingImpact: "No components registered.",
    recommendedRecoverySequence: ["Monitor heartbeats", "Track latency anomalies", "Keep audits enabled"]
  };
}

export function createMockWorkflow(_components: ConnectionComponent[]) {
  const steps: Array<{ title: string; type: ComponentType }> = [
    { title: "Terminal Heartbeat", type: "MT5 Terminal" },
    { title: "EA Bridge Session", type: "EA Bridge" },
    { title: "Broker Server Connection", type: "Broker Server" },
    { title: "Account Authentication", type: "Trading Account" },
    { title: "Symbol Availability", type: "Market Data Feed" },
    { title: "Market Data Feed", type: "Market Data Feed" },
    { title: "Order Router Channel", type: "Order Router" },
    { title: "Execution Queue", type: "Execution Queue" },
    { title: "MT5 Execution Feedback", type: "MT5 Feedback" },
    { title: "Audit Confirmation", type: "Audit Service" }
  ];

  return steps.map((s) => ({
    title: s.title,
    status: "Healthy" as ConnectionStatus,
    componentCount: 0,
    failedCount: 0,
    averageLatencyMs: 0,
    lastSuccessfulEvent: null,
    bottleneckWarning: "No bottleneck detected",
    aiRecommendation: "Maintain heartbeats and monitor latency variance."
  }));
}

export function createMockLatencyAndPacketLoss(): { latency: LatencyPoint[]; packetLoss: PacketLossPoint[] } {
  return { latency: [], packetLoss: [] };
}

export function createMockHeartbeats(_components: ConnectionComponent[]): HeartbeatMonitorRow[] {
  return [];
}

export function createMockIncidents(): ConnectionIncident[] {
  return [];
}

export function createMockLogs(): ConnectionLogEntry[] {
  return [];
}

export function createMockDiagnostics(): AiDiagnosticsResponse {
  return { meta: { timestamp: isoNow() }, diagnostics: [] };
}

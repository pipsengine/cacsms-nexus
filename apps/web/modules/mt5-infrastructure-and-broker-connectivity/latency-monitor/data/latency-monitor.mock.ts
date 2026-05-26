import type {
  AiLatencyDiagnostic,
  LatencyBrokerComparisonRow,
  LatencyLogEntry,
  LatencyMetric,
  LatencyThreshold,
  LatencyTrendPoint,
  LatencyWorkflowNode
} from "../types/latency-monitor.types";

export function createMockThresholds(): LatencyThreshold[] {
  return [];
}

export function createMockMetrics(_thresholds: LatencyThreshold[]): LatencyMetric[] {
  return [];
}

export function createMockTrends(_metrics: LatencyMetric[]): LatencyTrendPoint[] {
  return [];
}

export function createMockBrokerComparison(_metrics: LatencyMetric[]): LatencyBrokerComparisonRow[] {
  return [];
}

export function createMockLogs(_metrics: LatencyMetric[]): LatencyLogEntry[] {
  return [];
}

export function createMockAiDiagnostics(_metrics: LatencyMetric[]): AiLatencyDiagnostic[] {
  return [];
}

export function createLatencyMonitorSeed() {
  return {
    thresholds: [],
    metrics: [],
    alerts: [],
    trends: [],
    brokerComparison: [],
    workflow: [] as LatencyWorkflowNode[],
    logs: [],
    aiDiagnostics: []
  };
}

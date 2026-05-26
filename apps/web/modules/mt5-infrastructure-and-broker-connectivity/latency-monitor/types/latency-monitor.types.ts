import type { AuditRecord, Mt5Role, ScoreResult } from "../../mt5-control-center/types/mt5-control-center.types";

export type LatencyComponentType =
  | "MT5 Terminal"
  | "Broker Server"
  | "EA Bridge"
  | "Order Router"
  | "Execution Queue"
  | "Market Data Feed"
  | "MT5 Feedback"
  | "Host Machine"
  | "Unknown";

export type LatencyType =
  | "Broker Ping"
  | "EA Bridge Round Trip"
  | "Terminal Heartbeat"
  | "Market Data"
  | "Order Routing"
  | "Execution Queue"
  | "Execution Feedback"
  | "Unknown";

export type LatencyBreachStatus = "Normal" | "Warning" | "Critical" | "Blocked";
export type LatencyRiskLevel = "Low" | "Moderate" | "Elevated" | "High" | "Critical";

export type LatencyMetric = {
  id: string;
  metricId: string;
  componentType: LatencyComponentType;
  componentName: string;
  brokerId: string | null;
  broker: string | null;
  accountId: string | null;
  account: string | null;
  terminalId: string | null;
  terminal: string | null;
  eaInstanceId: string | null;
  eaInstance: string | null;
  symbol: string | null;
  latencyType: LatencyType;
  currentLatencyMs: number;
  averageLatencyMs: number;
  minimumLatencyMs: number;
  maximumLatencyMs: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  jitterMs: number;
  timeoutCount: number;
  thresholdId: string;
  thresholdValueMs: number;
  breachStatus: LatencyBreachStatus;
  trendDirection: "Up" | "Down" | "Flat";
  lastMeasuredAt: string;
  riskLevel: LatencyRiskLevel;
  routeBlocked: boolean;
};

export type LatencyThreshold = {
  id: string;
  componentType: LatencyComponentType;
  brokerId: string | null;
  accountType: string;
  symbol: string | null;
  assetClass: string;
  strategyType: string;
  tradingSession: string;
  volatilityRegime: "Calm" | "Normal" | "Volatile";
  newsImpactLevel: "Low" | "Medium" | "High";
  normalLatencyLimitMs: number;
  warningLatencyLimitMs: number;
  criticalLatencyLimitMs: number;
  executionBlockLatencyMs: number;
  scalpingMaxLatencyMs: number;
  newsMultiplier: number;
  autoDisableEnabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type LatencyWorkflowNode = {
  title: string;
  status: "Healthy" | "Watch" | "Degraded" | "Critical";
  averageLatencyMs: number;
  failedCount: number;
  bottleneckStage: string;
  latestBreach: string;
  aiRecommendation: string;
};

export type LatencyBrokerComparisonRow = {
  brokerId: string;
  broker: string;
  serverRegion: string;
  averageLatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  packetLossPercent: number;
  executionResponseTimeMs: number;
  marketDataDelayMs: number;
  stabilityScore: number;
  rank: number;
  recommendedUse: string;
};

export type LatencyTrendPoint = {
  measuredAt: string;
  brokerId: string | null;
  broker: string | null;
  terminalId: string | null;
  terminal: string | null;
  componentType: LatencyComponentType;
  latencyType: LatencyType;
  currentLatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  jitterMs: number;
};

export type LatencyTestResult = {
  id: string;
  testId: string;
  testType: "Ping" | "Round Trip";
  componentType: LatencyComponentType;
  brokerId: string | null;
  accountId: string | null;
  terminalId: string | null;
  eaInstanceId: string | null;
  startedAt: string;
  completedAt: string;
  latencyMs: number;
  roundTripMs: number | null;
  packetLossPercent: number;
  timeoutOccurred: boolean;
  testStatus: "Success" | "Failed";
  failureReason: string | null;
};

export type LatencyAlert = {
  id: string;
  timestamp: string;
  metricId: string;
  componentType: LatencyComponentType;
  componentName: string;
  brokerId: string | null;
  broker: string | null;
  accountId: string | null;
  account: string | null;
  latencyType: LatencyType;
  currentLatencyMs: number;
  thresholdValueMs: number;
  alertType:
    | "Warning"
    | "Critical"
    | "Broker Latency"
    | "EA Bridge Delay"
    | "Terminal Delay"
    | "Market Data Delay"
    | "Order Router Delay"
    | "Execution Queue Delay"
    | "Execution Feedback Delay"
    | "Route Blocked";
  severity: "Info" | "Warning" | "Critical";
  routeBlocked: boolean;
  rootCause: string;
  aiExplanation: string;
  resolutionStatus: "Resolved" | "Unresolved";
  resolvedAt: string | null;
};

export type LatencyLogEntry = {
  id: string;
  timestamp: string;
  eventType: string;
  severity: "Info" | "Warning" | "Critical";
  metricId: string | "ALL";
  message: string;
  statusBefore: string;
  statusAfter: string;
  currentLatencyMs: number;
  routeBlocked: boolean;
  actionTaken: string;
};

export type AiLatencyDiagnostic = {
  id: string;
  issue: string;
  affectedComponent: string;
  affectedContext: string;
  severity: "Info" | "Warning" | "Critical";
  rootCause: string;
  tradingImpact: string;
  recommendedAction: string;
  autoBlockRecommendation: boolean;
  confidenceScore: number;
};

export type LatencyMonitorSummaryResponse = {
  meta: { timestamp: string; currentRole: Mt5Role; streamEndpoint: string };
  kpis: Array<{ label: string; value: string; status: "Healthy" | "Watch" | "Degraded" | "Critical"; detail: string; updatedAt: string }>;
  latencyRiskScore: ScoreResult;
};

export type WorkflowResponse = { meta: { timestamp: string }; workflow: LatencyWorkflowNode[] };
export type MetricsResponse = { meta: { timestamp: string; total: number; page: number; pageSize: number }; metrics: LatencyMetric[] };
export type MetricResponse = { meta: { timestamp: string }; metric: LatencyMetric };
export type BrokerComparisonResponse = { meta: { timestamp: string; total: number }; comparisons: LatencyBrokerComparisonRow[] };
export type TrendsResponse = { meta: { timestamp: string; total: number }; points: LatencyTrendPoint[] };
export type ThresholdsResponse = { meta: { timestamp: string; total: number }; thresholds: LatencyThreshold[] };
export type AlertsResponse = { meta: { timestamp: string; total: number }; alerts: LatencyAlert[] };
export type LogsResponse = { meta: { timestamp: string; total: number }; logs: LatencyLogEntry[] };
export type AiDiagnosticsResponse = { meta: { timestamp: string; total: number }; diagnostics: AiLatencyDiagnostic[] };

export type ActionResponse = { meta: { timestamp: string }; ok: boolean; message: string; affected?: string[] };
export type TestResponse = { meta: { timestamp: string }; result: LatencyTestResult };

export type ThresholdCreateRequest = Omit<LatencyThreshold, "id" | "createdAt" | "updatedAt">;
export type ThresholdUpdateRequest = Partial<Omit<LatencyThreshold, "id" | "createdAt" | "updatedAt">>;

export type LatencyMonitorAudit = AuditRecord;


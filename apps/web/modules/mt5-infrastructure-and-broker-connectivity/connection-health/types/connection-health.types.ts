import type { Mt5Role, ScoreResult } from "../../mt5-control-center/types/mt5-control-center.types";

export type ComponentType =
  | "Host Machine"
  | "MT5 Terminal"
  | "EA Bridge"
  | "Broker Server"
  | "Trading Account"
  | "Market Data Feed"
  | "Risk Engine"
  | "Order Router"
  | "Execution Queue"
  | "MT5 Feedback"
  | "Audit Service";

export type ConnectionStatus = "Healthy" | "Syncing" | "Degraded" | "Critical" | "Offline" | "Unknown";
export type HeartbeatStatus = "Healthy" | "Watch" | "Degraded" | "Critical" | "Offline";
export type RiskLevel = "Low" | "Moderate" | "High" | "Critical";

export type ConnectionComponent = {
  id: string;
  componentId: string;
  componentType: ComponentType;
  componentName: string;
  broker: string | null;
  account: string | null;
  terminal: string | null;
  eaInstance: string | null;
  hostMachine: string;
  serverRegion: string;
  environment: "Development" | "Staging" | "Production";
  connectionStatus: ConnectionStatus;
  heartbeatStatus: HeartbeatStatus;
  lastHeartbeat: string | null;
  expectedHeartbeatIntervalSeconds: number;
  latencyMs: number;
  packetLossPercent: number;
  uptimePercent: number;
  errorCount: number;
  retryCount: number;
  lastIncident: string | null;
  healthScore: number;
  riskLevel: RiskLevel;
  tradingPathActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ConnectionWorkflowNode = {
  title: string;
  status: ConnectionStatus;
  componentCount: number;
  failedCount: number;
  averageLatencyMs: number;
  lastSuccessfulEvent: string;
  bottleneckWarning: string;
  aiRecommendation: string;
};

export type DependencyNodeTone = "Healthy" | "Syncing" | "Degraded" | "Critical" | "Ai Warning" | "Unknown";

export type DependencyNode = {
  id: string;
  label: string;
  componentType: ComponentType;
  tone: DependencyNodeTone;
  healthScore: number;
};

export type DependencyEdge = {
  id: string;
  from: string;
  to: string;
  dependencyType: string;
  status: ConnectionStatus;
  failureImpact: string;
  lastCheckedAt: string;
};

export type DependencyMapResponse = {
  meta: { timestamp: string };
  nodes: DependencyNode[];
  edges: DependencyEdge[];
  firstFailedComponentId: string | null;
  downstreamImpactedComponentIds: string[];
  tradingImpact: string;
  recommendedRecoverySequence: string[];
};

export type HeartbeatMonitorRow = {
  componentId: string;
  componentType: ComponentType;
  expectedHeartbeatIntervalSeconds: number;
  lastHeartbeat: string | null;
  heartbeatDelaySeconds: number;
  missedHeartbeatCount: number;
  availabilityPercent: number;
  status: HeartbeatStatus;
  recoveryAction: string;
  nextCheckTime: string;
};

export type HeartbeatsResponse = {
  meta: { timestamp: string; total: number };
  heartbeats: HeartbeatMonitorRow[];
};

export type LatencyPoint = {
  measuredAt: string;
  componentType: ComponentType;
  broker: string | null;
  latencyMs: number;
};

export type PacketLossPoint = {
  measuredAt: string;
  componentType: ComponentType;
  broker: string | null;
  packetLossPercent: number;
};

export type LatencyResponse = { meta: { timestamp: string }; points: LatencyPoint[] };
export type PacketLossResponse = { meta: { timestamp: string }; points: PacketLossPoint[] };

export type ConnectionIncident = {
  id: string;
  timestamp: string;
  componentId: string;
  componentType: ComponentType;
  broker: string | null;
  account: string | null;
  incidentType: string;
  severity: "Info" | "Warning" | "Critical";
  errorCode: string;
  errorMessage: string;
  rootCause: string;
  actionTaken: string;
  resolutionStatus: "Resolved" | "Unresolved";
  aiExplanation: string;
};

export type IncidentsResponse = {
  meta: { timestamp: string; total: number };
  incidents: ConnectionIncident[];
};

export type ConnectionLogEntry = {
  id: string;
  timestamp: string;
  componentId: string | "ALL";
  componentType: ComponentType | "ALL";
  eventType: string;
  severity: "Info" | "Warning" | "Critical";
  statusBefore: string;
  statusAfter: string;
  latencyMs: number;
  packetLossPercent: number;
  heartbeatDelaySeconds: number;
  message: string;
  rootCause: string;
  actionTaken: string;
  resolved: boolean;
  resolvedAt: string | null;
};

export type LogsResponse = {
  meta: { timestamp: string; total: number };
  logs: ConnectionLogEntry[];
};

export type AiConnectionDiagnostic = {
  id: string;
  issue: string;
  affectedComponentId: string;
  dependencyImpact: string;
  severity: "Info" | "Warning" | "Critical";
  rootCause: string;
  tradingImpact: string;
  recommendedAction: string;
  autoFixEligible: boolean;
  confidenceScore: number;
};

export type AiDiagnosticsResponse = {
  meta: { timestamp: string };
  diagnostics: AiConnectionDiagnostic[];
};

export type ConnectionHealthSummaryResponse = {
  meta: { timestamp: string; currentRole: Mt5Role; streamEndpoint: string };
  kpis: Array<{ label: string; value: string; status: ConnectionStatus | "Watch"; detail: string; updatedAt: string }>;
  overallHealth: ScoreResult;
  infrastructureRiskLevel: RiskLevel;
};

export type ComponentsResponse = {
  meta: { timestamp: string; total: number; page: number; pageSize: number };
  components: ConnectionComponent[];
};

export type ComponentResponse = { meta: { timestamp: string }; component: ConnectionComponent };
export type WorkflowResponse = { meta: { timestamp: string }; workflow: ConnectionWorkflowNode[] };

export type ActionResponse = {
  meta: { timestamp: string };
  ok: boolean;
  message: string;
  affectedComponentIds?: string[];
};


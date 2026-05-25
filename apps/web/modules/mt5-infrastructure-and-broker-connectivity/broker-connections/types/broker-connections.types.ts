import type { AuditRecord, Mt5Role } from "../../mt5-control-center/types/mt5-control-center.types";

export type BrokerTone = "Healthy" | "Watch" | "Degraded" | "Critical" | "Offline" | "Syncing" | "Inactive";
export type BrokerSeverity = "Info" | "Warning" | "Critical";

export type BrokerConnection = {
  id: string;
  brokerId: string;
  brokerName: string;
  brokerCode: string;
  mt5ServerName: string;
  serverRegion: string;
  connectionMode: string;
  supportedAccountTypes: string[];
  supportedInstruments: string[];
  timezone: string;
  tradingSessions: string;
  connectionStatus: BrokerTone;
  loginStatus: BrokerTone;
  dataFeedStatus: BrokerTone;
  executionStatus: BrokerTone;
  serverReachable: boolean;
  loginSuccessRate: number;
  lastSuccessfulLoginAt: string;
  failedLoginCount: number;
  averageLatencyMs: number;
  packetLossPercent: number;
  heartbeatDelaySeconds: number;
  uptimePercent: number;
  spreadStabilityScore: number;
  slippageScore: number;
  requoteRate: number;
  rejectionRate: number;
  fillQualityScore: number;
  averageExecutionTimeMs: number;
  executionEnabled: boolean;
  lastRejectedOrderReason: string | null;
  dataFeedActive: boolean;
  lastTickAt: string;
  tickDelaySeconds: number;
  candleSyncStatus: BrokerTone;
  frozenFeedStatus: BrokerTone;
  spreadWideningStatus: BrokerTone;
  missingDataGapCount: number;
  lastConnectedAt: string;
  lastDisconnectedAt: string | null;
  lastErrorMessage: string | null;
  riskLevel: BrokerTone;
  healthScore: number;
  updatedAt: string;
};

export type BrokerConnectionTest = {
  id: string;
  brokerId: string;
  testType: string;
  testStatus: BrokerTone;
  latencyMs: number;
  loginSuccess: boolean;
  dataFeedSuccess: boolean;
  executionGatewaySuccess: boolean;
  symbolSyncSuccess: boolean;
  accountSyncSuccess: boolean;
  failureReason: string | null;
  testedBy: string;
  createdAt: string;
};

export type BrokerIncident = {
  id: string;
  brokerId: string;
  brokerName: string;
  serverName: string;
  accountLogin: string;
  incidentType: "Connection Loss" | "Login Failure" | "Market Data Issue" | "Spread Spike" | "Execution Delay" | "Trade Rejection" | "Requote" | "Server Timeout" | "Recovery";
  severity: BrokerSeverity;
  errorCode: string;
  errorMessage: string;
  rootCause: string;
  actionTaken: string;
  autoResolved: boolean;
  resolutionStatus: "Open" | "Monitoring" | "Resolved";
  resolvedAt?: string;
  createdAt: string;
};

export type BrokerLatencyLog = {
  id: string;
  brokerId: string;
  brokerName: string;
  latencyMs: number;
  packetLossPercent: number;
  heartbeatDelaySeconds: number;
  serverReachable: boolean;
  measuredAt: string;
};

export type BrokerSpreadLog = {
  id: string;
  brokerId: string;
  brokerName: string;
  symbol: string;
  spreadPoints: number;
  averageSpreadPoints: number;
  spreadStabilityScore: number;
  abnormalSpreadDetected: boolean;
  measuredAt: string;
};

export type BrokerExecutionQuality = {
  id: string;
  brokerId: string;
  brokerName: string;
  accountId: string;
  symbol: string;
  orderType: string;
  executionTimeMs: number;
  slippagePoints: number;
  requoteDetected: boolean;
  rejected: boolean;
  rejectionReason?: string;
  fillQualityScore: number;
  createdAt: string;
};

export type BrokerDiagnostic = {
  id: string;
  brokerId: string;
  affectedBroker: string;
  issue: string;
  severity: BrokerSeverity;
  rootCause: string;
  tradingImpact: string;
  recommendation: string;
  confidenceScore: number;
  autoRemediationAvailable: boolean;
  autoRemediationStatus: "Available" | "Approval Required" | "Running" | "Completed" | "Blocked";
  escalationRequired: boolean;
  createdAt: string;
};

export type BrokerWorkflowNode = {
  title: string;
  status: BrokerTone;
  count: number;
  failureCount: number;
  averageDelayMs: number;
  lastCheckedAt: string;
  aiRecommendation?: string;
};

export type BrokerScore = {
  score: number;
  rating: "Excellent" | "Healthy" | "Degraded" | "High Risk" | "Critical";
  factors: Record<string, number>;
};

export type BrokerRankings = {
  ranked: Array<{ brokerId: string; brokerName: string; score: number }>;
  bestExecutionBroker: string;
  bestDataBroker: string;
  mostStableBroker: string;
  highestRiskBroker: string;
  brokerRequiringReview: string;
};

export type BrokerConnectionsResponse = {
  meta: { timestamp: string; currentRole: Mt5Role; streamEndpoint: string; monitoringMode: "Autonomous Broker Monitoring" };
  kpis: Array<{ label: string; value: string; status: BrokerTone; detail: string; updatedAt: string }>;
  workflow: BrokerWorkflowNode[];
  brokers: BrokerConnection[];
  connectionTests: BrokerConnectionTest[];
  rankings: BrokerRankings;
  latencyLogs: BrokerLatencyLog[];
  spreadLogs: BrokerSpreadLog[];
  executionQuality: BrokerExecutionQuality[];
  incidents: BrokerIncident[];
  diagnostics: BrokerDiagnostic[];
  audits: AuditRecord[];
  permissions: {
    role: Mt5Role;
    canSync: boolean;
    canTest: boolean;
    canReconnect: boolean;
    canDiagnostics: boolean;
    canExecutionControl: boolean;
    canApproveRestoration: boolean;
    canAutoRemediate: boolean;
    canDelete: boolean;
  };
};

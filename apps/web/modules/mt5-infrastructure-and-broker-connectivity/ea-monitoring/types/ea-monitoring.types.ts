import type { AuditRecord, Mt5Role, ScoreResult } from "../../mt5-control-center/types/mt5-control-center.types";

export type EaConnectionStatus = "Online" | "Offline" | "Degraded";
export type EaHeartbeatStatus = "Active" | "Missing" | "Delayed";
export type EaBridgeStatus = "Connected" | "Disconnected" | "Degraded";
export type EaChannelStatus = "Ready" | "Degraded" | "Down";
export type EaEnvironment = "Production" | "Staging" | "Development";
export type EaRiskLevel = "Low" | "Moderate" | "Elevated" | "High" | "Critical";

export type EaMonitoringWorkflowNode = {
  title:
    | "EA Registered"
    | "Terminal Bound"
    | "Broker Account Linked"
    | "Strategy Bound"
    | "Symbol Scope Loaded"
    | "Heartbeat Active"
    | "Bridge Connected"
    | "Risk Rules Loaded"
    | "Command Channel Ready"
    | "Execution Feedback Active";
  status: "Healthy" | "Watch" | "Degraded" | "Critical";
  eaCount: number;
  failedCount: number;
  averageDelayMs: number;
  latestFailure: string;
  aiRecommendation: string;
};

export type EaReadiness = {
  heartbeatActive: boolean;
  terminalOnline: boolean;
  bridgeConnected: boolean;
  brokerAccountAuthenticated: boolean;
  strategyBindingValid: boolean;
  symbolScopeValid: boolean;
  riskRulesLoaded: boolean;
  tradingEnabled: boolean;
  emergencyStopInactive: boolean;
  spreadFilterActive: boolean;
  slippageFilterActive: boolean;
  latencyFilterActive: boolean;
  duplicateProtectionActive: boolean;
  executionReady: boolean;
  blockers: string[];
};

export type EaInstance = {
  id: string;
  eaId: string;
  eaName: string;
  eaVersion: string;
  buildNumber: string;
  magicNumber: string;
  terminalId: string;
  terminal: string;
  brokerId: string;
  broker: string;
  accountId: string;
  accountLogin: string;
  hostMachine: string;
  environment: EaEnvironment;
  strategyId: string | null;
  strategyName: string | null;
  strategyVersion: string | null;
  symbolScope: string[];
  timeframeScope: string[];
  riskProfile: string;
  connectionStatus: EaConnectionStatus;
  heartbeatStatus: EaHeartbeatStatus;
  lastHeartbeatAt: string | null;
  heartbeatDelaySeconds: number;
  bridgeStatus: EaBridgeStatus;
  commandChannelStatus: EaChannelStatus;
  executionFeedbackStatus: EaChannelStatus;
  tradingEnabled: boolean;
  accountTradingAllowed: boolean;
  symbolTradingAllowed: boolean;
  riskRulesLoaded: boolean;
  duplicateProtectionActive: boolean;
  spreadFilterActive: boolean;
  slippageFilterActive: boolean;
  latencyFilterActive: boolean;
  emergencyStopActive: boolean;
  commandSuccessRate: number;
  failedCommands: number;
  averageLatencyMs: number;
  uptimeSeconds: number;
  restartCount: number;
  lastError: string | null;
  riskLevel: EaRiskLevel;
  healthScore: number;
  readiness: EaReadiness;
  createdAt: string;
  updatedAt: string;
};

export type EaCommandType =
  | "Open order"
  | "Modify SL"
  | "Modify TP"
  | "Close position"
  | "Partial close"
  | "Cancel pending order"
  | "Sync position"
  | "Sync account"
  | "Heartbeat"
  | "Status report";

export type EaCommandStatus = "Queued" | "Delivered" | "Executed" | "Rejected" | "Timed Out" | "Failed";
export type RiskApprovalStatus = "Approved" | "Blocked" | "Expired";

export type EaCommand = {
  id: string;
  commandId: string;
  eaId: string;
  eaInstance: string;
  strategyId: string | null;
  strategyName: string | null;
  accountId: string;
  account: string;
  brokerId: string;
  broker: string;
  symbol: string;
  commandType: EaCommandType;
  direction: "Buy" | "Sell" | "None";
  volume: number | null;
  commandStatus: EaCommandStatus;
  riskApprovalStatus: RiskApprovalStatus;
  deliveredAt: string | null;
  executedAt: string | null;
  responseTimeMs: number | null;
  mt5Ticket: string | null;
  failureReason: string | null;
  createdAt: string;
};

export type EaStrategyBinding = {
  id: string;
  eaId: string;
  eaInstance: string;
  strategyId: string;
  strategyName: string;
  strategyVersion: string;
  symbolsAllowed: string[];
  timeframesAllowed: string[];
  riskProfile: string;
  maxRiskPerTrade: number;
  maxDailyRisk: number;
  tradeFrequencyLimit: number;
  tradingSessionRules: string;
  newsRestrictionStatus: "Loaded" | "Missing" | "Mismatch";
  bindingStatus: "Bound" | "Missing" | "Mismatch";
  lastBindingUpdateAt: string;
  createdAt: string;
  updatedAt: string;
};

export type EaLogRecord = {
  id: string;
  timestamp: string;
  eaId: string;
  eaInstance: string;
  terminal: string;
  broker: string;
  account: string;
  errorType: string;
  severity: "Info" | "Warning" | "Critical";
  message: string;
  sourceModule: string;
  repeatCount: number;
  resolutionStatus: "Resolved" | "Unresolved";
  aiExplanation: string;
  resolvedAt: string | null;
};

export type EaExceptionRecord = {
  id: string;
  timestamp: string;
  eaId: string;
  eaInstance: string;
  terminal: string;
  broker: string;
  account: string;
  exceptionType:
    | "Offline"
    | "Heartbeat Missing"
    | "Bridge Error"
    | "Command Failure"
    | "Strategy Binding Error"
    | "Risk Rule Error"
    | "Execution Error"
    | "Symbol Scope Mismatch"
    | "Suspicious Behavior";
  severity: "Info" | "Warning" | "Critical";
  rootCause: string;
  tradingImpact: string;
  resolutionStatus: "Resolved" | "Unresolved";
  assignedTo: string | null;
  aiExplanation: string;
  resolvedAt: string | null;
  createdAt: string;
};

export type EaAnalyticsPoint = {
  measuredAt: string;
  eaId: string;
  uptimePercent: number;
  heartbeatDelaySeconds: number;
  commandSuccessRate: number;
  failedCommandRate: number;
  averageLatencyMs: number;
  restartFrequency: number;
  errorFrequency: number;
  executionFeedbackCompleteness: number;
};

export type AiEaDiagnostic = {
  id: string;
  eaId: string;
  eaInstance: string;
  issueSummary: string;
  severity: "Info" | "Warning" | "Critical";
  rootCause: string;
  tradingImpact: string;
  recommendedFix: string;
  autoRemediationEligible: boolean;
  confidenceScore: number;
  escalationRequired: boolean;
  createdAt: string;
  resolvedAt: string | null;
};

export type EaKpi = {
  label:
    | "Total EA Instances"
    | "Active EAs"
    | "Offline EAs"
    | "Degraded EAs"
    | "Trading Enabled EAs"
    | "Trading Disabled EAs"
    | "Average EA Heartbeat Delay"
    | "Average Command Latency"
    | "Failed Commands"
    | "Message Throughput"
    | "Highest Risk EA"
    | "EA Health Score";
  value: string;
  status: "Healthy" | "Watch" | "Degraded" | "Critical";
  detail: string;
  updatedAt: string;
};

export type EaMonitoringSummaryResponse = {
  meta: { timestamp: string; currentRole: Mt5Role; streamEndpoint: string };
  kpis: EaKpi[];
  eaHealthScore: ScoreResult;
};

export type InstancesResponse = { meta: { timestamp: string; total: number; page: number; pageSize: number }; instances: EaInstance[] };
export type InstanceResponse = { meta: { timestamp: string }; instance: EaInstance };
export type WorkflowResponse = { meta: { timestamp: string }; workflow: EaMonitoringWorkflowNode[] };
export type CommandsResponse = { meta: { timestamp: string; total: number; page: number; pageSize: number }; commands: EaCommand[] };
export type StrategyBindingsResponse = { meta: { timestamp: string; total: number }; bindings: EaStrategyBinding[] };
export type LogsResponse = { meta: { timestamp: string; total: number }; logs: EaLogRecord[] };
export type ExceptionsResponse = { meta: { timestamp: string; total: number }; exceptions: EaExceptionRecord[] };
export type AnalyticsResponse = { meta: { timestamp: string; total: number }; points: EaAnalyticsPoint[] };
export type AiDiagnosticsResponse = { meta: { timestamp: string; total: number }; diagnostics: AiEaDiagnostic[] };
export type AuditResponse = { meta: { timestamp: string; total: number }; audit: AuditRecord[] };

export type ActionResponse = { meta: { timestamp: string }; ok: boolean; message: string; affected?: string[] };

export type RebindStrategyRequest = { strategyId: string; strategyName: string; strategyVersion: string };
export type RebindTerminalRequest = { terminalId: string; terminal: string };
export type AutoRemediateRequest = { eaId: string };
export type ExportRequest = { format: "json" | "csv"; filters?: { search?: string; status?: string; risk?: EaRiskLevel | "all"; trading?: "enabled" | "disabled" | "all" } };

export type EaMonitoringAudit = AuditRecord;

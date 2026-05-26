import type { AuditRecord, Mt5Role, ScoreResult } from "../../mt5-control-center/types/mt5-control-center.types";

export type ExecutionDirection = "Buy" | "Sell";
export type ExecutionOrderType = "Market" | "Limit" | "Stop" | "Stop Limit";
export type ExecutionStatus =
  | "Pending"
  | "Sent"
  | "Delivered"
  | "Executed"
  | "Partially Filled"
  | "Rejected"
  | "Requoted"
  | "Cancelled"
  | "Failed"
  | "Timed Out"
  | "Missing Feedback"
  | "Synced";

export type FillStatus = "Unknown" | "Not Filled" | "Partially Filled" | "Filled";
export type RiskLevel = "Low" | "Moderate" | "Elevated" | "High" | "Critical";
export type ReviewedStatus = "Unreviewed" | "Reviewed";

export type ExecutionLifecycleNode = {
  title:
    | "Signal Approved"
    | "Order Queued"
    | "Risk Passed"
    | "Route Assigned"
    | "EA Command Sent"
    | "Broker Response Received"
    | "MT5 Ticket Created"
    | "Fill Confirmed"
    | "Trade Synced"
    | "Audit Completed";
  status: "Healthy" | "Watch" | "Degraded" | "Critical";
  eventCount: number;
  failedCount: number;
  averageDurationMs: number;
  latestFailure: string;
  aiRecommendation: string;
};

export type ExecutionLog = {
  id: string;
  logId: string;
  occurredAt: string;
  executionId: string;
  orderId: string;
  signalId: string | null;
  strategyId: string;
  sourceEngine: string;
  accountId: string;
  account: string;
  brokerId: string;
  broker: string;
  terminalId: string;
  terminal: string;
  eaInstanceId: string | null;
  eaInstance: string | null;
  symbol: string;
  normalizedSymbol: string;
  brokerSymbol: string;
  direction: ExecutionDirection;
  orderType: ExecutionOrderType;
  volume: number;
  requestedPrice: number;
  stopLoss: number | null;
  takeProfit: number | null;
  timeInForce: "IOC" | "FOK" | "GTC" | "DAY";
  expiryTime: string | null;
  mt5Ticket: string | null;
  executedPrice: number | null;
  executedVolume: number | null;
  executionStatus: ExecutionStatus;
  fillStatus: FillStatus;
  brokerResponseCode: string | null;
  brokerResponseMessage: string | null;
  slippagePoints: number | null;
  spreadAtExecution: number | null;
  executionTimeMs: number | null;
  retryCount: number;
  riskLevel: RiskLevel;
  reviewedStatus: ReviewedStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type BrokerResponseRecord = {
  id: string;
  executionLogId: string;
  brokerId: string;
  broker: string;
  accountId: string;
  account: string;
  orderId: string;
  mt5Ticket: string | null;
  responseCode: string;
  responseMessage: string;
  rejectionReason: string | null;
  requoteDetected: boolean;
  offQuotesDetected: boolean;
  marginRejectionDetected: boolean;
  invalidVolumeDetected: boolean;
  tradeContextBusyDetected: boolean;
  requiredFix: string;
  aiExplanation: string;
  createdAt: string;
};

export type RetryCancellationRecord = {
  id: string;
  originalExecutionId: string;
  retryExecutionId: string | null;
  orderId: string;
  retryCount: number;
  retryReason: string | null;
  retryEligibility: "Eligible" | "Ineligible";
  safeRetryStatus: "Safe" | "Unsafe";
  cancellationReason: string | null;
  cancelledBy: string | null;
  cancelledAt: string | null;
  finalOutcome: string;
  createdAt: string;
};

export type ExecutionException = {
  id: string;
  occurredAt: string;
  executionLogId: string;
  executionId: string;
  orderId: string;
  brokerId: string;
  broker: string;
  accountId: string;
  account: string;
  symbol: string;
  exceptionType:
    | "Failed"
    | "Rejected"
    | "Requoted"
    | "Retried"
    | "Cancelled"
    | "Missing Feedback"
    | "Missing Ticket"
    | "Slippage Breach"
    | "Timeout";
  severity: "Info" | "Warning" | "Critical";
  rootCause: string;
  tradingImpact: string;
  resolutionStatus: "Resolved" | "Unresolved";
  assignedTo: string | null;
  aiExplanation: string;
  resolvedAt: string | null;
  createdAt: string;
};

export type ExecutionQualityMetric = {
  id: string;
  brokerId: string;
  broker: string;
  accountId: string;
  account: string;
  strategyId: string;
  strategy: string;
  symbol: string;
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  rejectedExecutions: number;
  requoteCount: number;
  retryCount: number;
  averageExecutionTimeMs: number;
  averageSlippagePoints: number;
  successRate: number;
  failureRate: number;
  executionQualityScore: number;
  measuredAt: string;
};

export type AiExecutionDiagnostic = {
  id: string;
  executionLogId: string;
  executionId: string;
  orderId: string;
  issueSummary: string;
  severity: "Info" | "Warning" | "Critical";
  likelyRootCause: string;
  tradingImpact: string;
  recommendedFix: string;
  fallbackRecommendation: string;
  confidenceScore: number;
  autoRemediationEligible: boolean;
  autoRemediationStatus: "Not Started" | "Running" | "Succeeded" | "Failed";
  escalationRequired: boolean;
  createdAt: string;
  resolvedAt: string | null;
};

export type ExecutionKpi = {
  label:
    | "Total Execution Events"
    | "Successful Executions"
    | "Failed Executions"
    | "Rejected Executions"
    | "Retried Executions"
    | "Cancelled Executions"
    | "Pending Confirmations"
    | "Average Execution Time"
    | "Average Slippage"
    | "Requote Count"
    | "Highest Risk Execution"
    | "Execution Quality Score";
  value: string;
  status: "Healthy" | "Watch" | "Degraded" | "Critical";
  detail: string;
  updatedAt: string;
};

export type ExecutionLogsSummaryResponse = {
  meta: { timestamp: string; currentRole: Mt5Role; streamEndpoint: string };
  kpis: ExecutionKpi[];
  executionQualityScore: ScoreResult;
};

export type ExecutionLogsResponse = { meta: { timestamp: string; total: number; page: number; pageSize: number }; logs: ExecutionLog[] };
export type ExecutionLogResponse = { meta: { timestamp: string }; log: ExecutionLog };
export type WorkflowResponse = { meta: { timestamp: string }; workflow: ExecutionLifecycleNode[] };
export type BrokerResponseResponse = { meta: { timestamp: string }; brokerResponse: BrokerResponseRecord };
export type RetryCancellationResponse = { meta: { timestamp: string }; retryCancellation: RetryCancellationRecord };
export type QualityAnalyticsResponse = { meta: { timestamp: string; total: number }; metrics: ExecutionQualityMetric[] };
export type ExceptionsResponse = { meta: { timestamp: string; total: number }; exceptions: ExecutionException[] };
export type AiDiagnosticsResponse = { meta: { timestamp: string; total: number }; diagnostics: AiExecutionDiagnostic[] };
export type AuditResponse = { meta: { timestamp: string; total: number }; audit: AuditRecord[] };

export type ActionResponse = { meta: { timestamp: string }; ok: boolean; message: string; affected?: string[] };

export type MarkReviewedRequest = { reviewedBy?: string };
export type EscalateRequest = { requiredAction: string; assignedRole?: "Trading Admin" | "Risk Manager" | "Infrastructure Admin" | "Super Admin" };
export type DiagnosticsRequest = { includeEvidence?: boolean };
export type AutoRemediateRequest = { logId: string };

export type ExportRequest = {
  format: "json" | "csv";
  filters?: {
    search?: string;
    status?: ExecutionStatus | "all";
    brokerId?: string | "all";
    symbol?: string | "all";
    severity?: ExecutionException["severity"] | "all";
    reviewed?: ReviewedStatus | "all";
  };
};

export type ExecutionLogsAudit = AuditRecord;

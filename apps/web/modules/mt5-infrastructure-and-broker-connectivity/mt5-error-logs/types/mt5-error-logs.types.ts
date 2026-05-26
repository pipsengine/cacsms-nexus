import type { AuditRecord, Mt5Role, ScoreResult } from "../../mt5-control-center/types/mt5-control-center.types";

export type Mt5ErrorSeverity = "Info" | "Warning" | "High" | "Critical" | "Emergency";
export type Mt5ErrorResolutionStatus = "Unresolved" | "In Progress" | "Resolved" | "Reopened";
export type Mt5ErrorRiskLevel = "Low" | "Moderate" | "Elevated" | "High" | "Critical";

export type Mt5ErrorSourceModule =
  | "MT5 Terminal"
  | "EA Bridge"
  | "Broker Connection"
  | "Account Sync"
  | "Order Router"
  | "Execution Queue"
  | "Trade Synchronization"
  | "Spread Monitor"
  | "Slippage Monitor"
  | "Latency Monitor"
  | "Market Data"
  | "Symbol Mapping"
  | "Database/API"
  | "Permission/Security"
  | "Infrastructure"
  | "Unknown";

export type Mt5ErrorType =
  | "Terminal Failure"
  | "Heartbeat Timeout"
  | "Broker Disconnect"
  | "Broker Login Failed"
  | "Account Authentication"
  | "EA Auth Failed"
  | "Symbol Mapping Mismatch"
  | "Market Data Gap"
  | "Order Routing Failure"
  | "Execution Failure"
  | "Execution Queue Backpressure"
  | "Trade Sync Mismatch"
  | "Database/API Failure"
  | "Permission Denied"
  | "Unsafe Trading Condition"
  | "Unknown";

export type Mt5Environment = "Production" | "Staging" | "Development";

export type Mt5ErrorLog = {
  id: string;
  errorId: string;
  occurredAt: string;
  sourceModule: Mt5ErrorSourceModule;
  errorType: Mt5ErrorType;
  severity: Mt5ErrorSeverity;
  brokerId: string | null;
  broker: string | null;
  accountId: string | null;
  account: string | null;
  terminalId: string | null;
  terminal: string | null;
  eaInstanceId: string | null;
  eaInstance: string | null;
  symbol: string | null;
  orderId: string | null;
  tradeId: string | null;
  mt5Ticket: string | null;
  errorCode: string | null;
  errorMessage: string;
  technicalDetails: string | null;
  stackTrace: string | null;
  payloadHash: string | null;
  statusBefore: string | null;
  statusAfter: string | null;
  repeatCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  resolutionStatus: Mt5ErrorResolutionStatus;
  assignedTo: string | null;
  riskLevel: Mt5ErrorRiskLevel;
  environment: Mt5Environment;
  hostMachine: string | null;
  fingerprintHash: string;
  aiRiskScore: number;
  createdAt: string;
  updatedAt: string;
};

export type Mt5ErrorFingerprint = {
  id: string;
  fingerprintHash: string;
  errorType: Mt5ErrorType;
  sourceModule: Mt5ErrorSourceModule;
  affectedComponentType: "Broker" | "Account" | "Terminal" | "EA Instance" | "Order" | "Symbol" | "Service" | "Unknown";
  affectedComponentId: string | null;
  repeatCount: number;
  frequencyScore: number;
  impactLevel: Mt5ErrorRiskLevel;
  suggestedPermanentFix: string;
  firstSeenAt: string;
  lastSeenAt: string;
  createdAt: string;
  updatedAt: string;
};

export type Mt5ErrorIncident = {
  id: string;
  incidentId: string;
  errorId: string;
  severity: Mt5ErrorSeverity;
  affectedService: string;
  tradingImpact: string;
  escalationStatus: "Open" | "Acknowledged" | "Mitigating" | "Resolved";
  assignedRole: "Infrastructure Admin" | "Trading Admin" | "Risk Manager" | "Super Admin";
  requiredAction: string;
  slaStatus: "Within SLA" | "At Risk" | "Breached";
  resolutionDeadline: string;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Mt5ErrorResolution = {
  id: string;
  errorId: string;
  resolutionAction: string;
  resolutionNote: string;
  resolvedBy: string | null;
  resolvedAt: string | null;
  reopenedBy: string | null;
  reopenedAt: string | null;
  reopenReason: string | null;
  createdAt: string;
};

export type Mt5ErrorAiDiagnostic = {
  id: string;
  errorId: string;
  issueSummary: string;
  rootCause: string;
  affectedComponents: string[];
  tradingImpact: string;
  recommendedFix: string;
  confidenceScore: number;
  autoRemediationEligible: boolean;
  autoRemediationStatus: "Not Started" | "In Progress" | "Succeeded" | "Failed";
  escalationRequired: boolean;
  createdAt: string;
  resolvedAt: string | null;
};

export type Mt5ErrorCategory = {
  key:
    | "Terminal errors"
    | "Broker connection errors"
    | "Account authentication errors"
    | "EA bridge errors"
    | "Symbol mapping errors"
    | "Market data errors"
    | "Spread/slippage/latency errors"
    | "Order routing errors"
    | "Execution queue errors"
    | "Trade synchronization errors"
    | "Database/API errors"
    | "Permission/security errors";
  count: number;
  criticalCount: number;
  topFingerprint: string | null;
  topMessage: string | null;
};

export type Mt5ErrorTrendPoint = {
  bucketStart: string;
  total: number;
  critical: number;
  warning: number;
  high: number;
  info: number;
  emergency: number;
  resolved: number;
  unresolved: number;
};

export type Mt5ErrorWorkflowNode = {
  title:
    | "Error Captured"
    | "Source Classified"
    | "Severity Scored"
    | "Duplicate Checked"
    | "Root Cause Analyzed"
    | "AI Recommendation Generated"
    | "Resolution Action Assigned"
    | "Audit Logged";
  status: "Healthy" | "Watch" | "Degraded" | "Critical";
  errorCount: number;
  failedCount: number;
  averageProcessingMs: number;
  latestCriticalError: string;
  aiRecommendation: string;
};

export type Mt5ErrorKpi = {
  label:
    | "Total Errors"
    | "Critical Errors"
    | "Warning Errors"
    | "Resolved Errors"
    | "Unresolved Errors"
    | "Repeated Errors"
    | "Terminal Errors"
    | "Broker Errors"
    | "EA Bridge Errors"
    | "Order Execution Errors"
    | "Sync Errors"
    | "AI Risk Score";
  value: string;
  status: "Healthy" | "Watch" | "Degraded" | "Critical";
  detail: string;
  updatedAt: string;
};

export type Mt5ErrorLogsSummaryResponse = {
  meta: { timestamp: string; currentRole: Mt5Role; streamEndpoint: string };
  kpis: Mt5ErrorKpi[];
  aiRiskScore: ScoreResult;
};

export type ErrorLogsResponse = {
  meta: { timestamp: string; total: number; page: number; pageSize: number };
  errors: Mt5ErrorLog[];
};

export type ErrorLogResponse = { meta: { timestamp: string }; error: Mt5ErrorLog };
export type WorkflowResponse = { meta: { timestamp: string }; workflow: Mt5ErrorWorkflowNode[] };
export type CategoriesResponse = { meta: { timestamp: string; total: number }; categories: Mt5ErrorCategory[] };
export type TrendsResponse = { meta: { timestamp: string; total: number }; points: Mt5ErrorTrendPoint[] };
export type RepeatedResponse = { meta: { timestamp: string; total: number }; fingerprints: Mt5ErrorFingerprint[] };
export type IncidentsResponse = { meta: { timestamp: string; total: number }; incidents: Mt5ErrorIncident[] };
export type AiDiagnosticsResponse = { meta: { timestamp: string; total: number }; diagnostics: Mt5ErrorAiDiagnostic[] };
export type ResolutionsResponse = { meta: { timestamp: string; total: number }; resolutions: Mt5ErrorResolution[] };
export type AuditResponse = { meta: { timestamp: string; total: number }; audit: AuditRecord[] };

export type ActionResponse = { meta: { timestamp: string }; ok: boolean; message: string; affected?: string[] };

export type ResolveRequest = { resolutionAction: string; resolutionNote: string; assignedTo?: string | null };
export type ReopenRequest = { reopenReason: string };
export type EscalateRequest = { requiredAction: string; assignedRole?: Mt5ErrorIncident["assignedRole"] };
export type DiagnosticsRequest = { includeRelated?: boolean };
export type AutoRemediateRequest = { errorId: string };

export type ExportRequest = {
  format: "json" | "csv";
  filters?: { search?: string; severity?: Mt5ErrorSeverity | "all"; module?: Mt5ErrorSourceModule | "all"; status?: Mt5ErrorResolutionStatus | "all"; brokerId?: string | "all" };
};

export type Mt5ErrorLogsAudit = AuditRecord;

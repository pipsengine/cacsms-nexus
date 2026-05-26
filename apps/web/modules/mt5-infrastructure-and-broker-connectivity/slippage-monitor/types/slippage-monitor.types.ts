import type { AuditRecord, Mt5Role, ScoreResult } from "../../mt5-control-center/types/mt5-control-center.types";

export type SlippageAssetClass = "Forex" | "Metals" | "Indices" | "Crypto" | "Unknown";
export type SlippageRiskLevel = "Low" | "Moderate" | "Elevated" | "High" | "Critical";

export type SlippageDirection = "Buy" | "Sell";
export type SlippageOrderType = "Market" | "Limit" | "Stop" | "Stop Limit";

export type SlippageBreachStatus = "Normal" | "Warning" | "Critical" | "Blocked";
export type SlippageQuality = "Excellent" | "Good" | "Degraded" | "Poor";

export type SlippageExecution = {
  id: string;
  executionId: string;
  orderId: string;
  tradeId: string | null;
  mt5Ticket: string | null;
  accountId: string;
  account: string;
  brokerId: string;
  broker: string;
  terminalId: string;
  terminal: string;
  eaInstanceId: string;
  eaInstance: string;
  strategyId: string;
  strategy: string;
  symbol: string;
  normalizedSymbol: string;
  assetClass: SlippageAssetClass;
  direction: SlippageDirection;
  orderType: SlippageOrderType;
  requestedPrice: number;
  executedPrice: number;
  slippagePoints: number;
  slippagePips: number;
  slippageValue: number;
  directionAdjustedSlippage: number;
  executionTimeMs: number;
  spreadAtExecution: number;
  marketVolatilityScore: number;
  tradingSession: string;
  newsWindowActive: boolean;
  thresholdId: string;
  thresholdValue: number;
  breachStatus: SlippageBreachStatus;
  executionQualityScore: number;
  executionQuality: SlippageQuality;
  riskLevel: SlippageRiskLevel;
  executionAllowed: boolean;
  createdAt: string;
};

export type SlippageThreshold = {
  id: string;
  symbol: string | null;
  normalizedSymbol: string;
  assetClass: SlippageAssetClass;
  brokerId: string | null;
  broker: string | null;
  accountType: string;
  strategyType: string;
  tradingSession: string;
  newsImpactLevel: "Low" | "Medium" | "High";
  volatilityRegime: "Calm" | "Normal" | "Volatile";
  normalLimitPips: number;
  warningLimitPips: number;
  criticalLimitPips: number;
  executionBlockLimitPips: number;
  maxRetrySlippagePips: number;
  newsMultiplier: number;
  autoDisableEnabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type SlippageWorkflowNode = {
  title: string;
  status: "Healthy" | "Watch" | "Degraded" | "Critical";
  orderCount: number;
  failedCount: number;
  averageDelayMs: number;
  latestBreach: string;
  aiRecommendation: string;
};

export type SlippageAlert = {
  id: string;
  timestamp: string;
  executionId: string;
  orderId: string;
  brokerId: string;
  broker: string;
  symbol: string;
  normalizedSymbol: string;
  requestedPrice: number;
  executedPrice: number;
  slippagePips: number;
  thresholdValuePips: number;
  alertType: "Warning" | "Critical" | "Broker Issue" | "Symbol Issue" | "News Driven" | "Volatility Driven" | "Execution Blocked";
  severity: "Info" | "Warning" | "Critical";
  executionBlocked: boolean;
  rootCause: string;
  aiExplanation: string;
  resolutionStatus: "Resolved" | "Unresolved";
  resolvedAt: string | null;
};

export type SlippageLogEntry = {
  id: string;
  timestamp: string;
  eventType: string;
  severity: "Info" | "Warning" | "Critical";
  executionId: string | "ALL";
  orderId: string | "ALL";
  brokerId: string | "ALL";
  symbol: string | "ALL";
  message: string;
  statusBefore: string;
  statusAfter: string;
  slippagePips: number;
  executionAllowed: boolean;
  actionTaken: string;
};

export type SlippageTrendPoint = {
  measuredAt: string;
  brokerId: string;
  broker: string;
  normalizedSymbol: string;
  strategy: string;
  tradingSession: string;
  slippagePips: number;
  executionTimeMs: number;
  spreadAtExecution: number;
};

export type BrokerSlippageComparisonRow = {
  brokerId: string;
  broker: string;
  normalizedSymbol: string;
  averageSlippagePips: number;
  medianSlippagePips: number;
  worstSlippagePips: number;
  positiveSlippageRate: number;
  negativeSlippageRate: number;
  averageExecutionTimeMs: number;
  requoteRate: number;
  rejectionRate: number;
  executionQualityRank: number;
};

export type AiSlippageDiagnostic = {
  id: string;
  issue: string;
  affected: string;
  severity: "Info" | "Warning" | "Critical";
  rootCause: string;
  tradingImpact: string;
  recommendedAction: string;
  autoBlockRecommendation: boolean;
  confidenceScore: number;
};

export type SlippageMonitorSummaryResponse = {
  meta: { timestamp: string; currentRole: Mt5Role; streamEndpoint: string };
  kpis: Array<{ label: string; value: string; status: "Healthy" | "Watch" | "Degraded" | "Critical"; detail: string; updatedAt: string }>;
  slippageRiskScore: ScoreResult;
  executionQualityScore: ScoreResult;
};

export type ExecutionsResponse = {
  meta: { timestamp: string; total: number; page: number; pageSize: number };
  executions: SlippageExecution[];
};

export type ExecutionResponse = { meta: { timestamp: string }; execution: SlippageExecution };
export type WorkflowResponse = { meta: { timestamp: string }; workflow: SlippageWorkflowNode[] };
export type TrendsResponse = { meta: { timestamp: string; total: number }; points: SlippageTrendPoint[] };
export type ThresholdsResponse = { meta: { timestamp: string; total: number }; thresholds: SlippageThreshold[] };
export type AlertsResponse = { meta: { timestamp: string; total: number }; alerts: SlippageAlert[] };
export type LogsResponse = { meta: { timestamp: string; total: number }; logs: SlippageLogEntry[] };
export type AiDiagnosticsResponse = { meta: { timestamp: string; total: number }; diagnostics: AiSlippageDiagnostic[] };
export type BrokerComparisonResponse = { meta: { timestamp: string; total: number }; comparisons: BrokerSlippageComparisonRow[] };

export type ActionResponse = { meta: { timestamp: string }; ok: boolean; message: string; affected?: string[] };

export type ThresholdCreateRequest = Omit<SlippageThreshold, "id" | "createdAt" | "updatedAt">;
export type ThresholdUpdateRequest = Partial<Omit<SlippageThreshold, "id" | "createdAt" | "updatedAt">>;

export type SlippageMonitorAudit = AuditRecord;


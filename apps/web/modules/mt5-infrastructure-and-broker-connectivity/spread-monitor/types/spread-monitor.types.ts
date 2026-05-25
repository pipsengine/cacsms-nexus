import type { AuditRecord, Mt5Role, ScoreResult } from "../../mt5-control-center/types/mt5-control-center.types";

export type SpreadAssetClass = "Forex" | "Metals" | "Indices" | "Crypto" | "Unknown";

export type SpreadStatus = "Normal" | "Wide" | "Critical" | "Unknown";
export type SpreadRiskLevel = "Low" | "Moderate" | "Elevated" | "High" | "Critical";

export type SpreadWorkflowNode = {
  title: string;
  status: "Healthy" | "Watch" | "Degraded" | "Critical";
  symbolCount: number;
  failedCount: number;
  averageDelayMs: number;
  latestAlert: string;
  aiRecommendation: string;
};

export type SpreadSnapshot = {
  id: string;
  symbol: string;
  normalizedSymbol: string;
  broker: string;
  brokerId: string;
  account: string;
  accountId: string;
  assetClass: SpreadAssetClass;
  bid: number;
  ask: number;
  digits: number;
  pointValue: number;
  contractSize: number;
  currentSpreadPips: number;
  averageSpreadPips: number;
  minimumSpreadPips: number;
  maximumSpreadPips: number;
  spreadDeviationPercent: number;
  spreadStabilityScore: number;
  thresholdId: string;
  threshold: SpreadThreshold;
  spreadStatus: SpreadStatus;
  executionAllowed: boolean;
  lastTickTime: string;
  riskLevel: SpreadRiskLevel;
};

export type SpreadTrendPoint = {
  measuredAt: string;
  normalizedSymbol: string;
  brokerId: string;
  broker: string;
  spreadPips: number;
  rollingAveragePips: number;
};

export type SpreadThreshold = {
  id: string;
  symbol: string | null;
  normalizedSymbol: string;
  assetClass: SpreadAssetClass;
  brokerId: string | null;
  broker: string | null;
  accountType: string;
  tradingSession: string;
  strategyType: string;
  newsImpactLevel: "Low" | "Medium" | "High";
  volatilityRegime: "Calm" | "Normal" | "Volatile";
  normalLimitPips: number;
  warningLimitPips: number;
  criticalLimitPips: number;
  executionBlockLimitPips: number;
  scalpingMaxSpreadPips: number;
  newsMultiplier: number;
  autoDisableEnabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type SpreadAlert = {
  id: string;
  timestamp: string;
  symbol: string;
  normalizedSymbol: string;
  brokerId: string;
  broker: string;
  accountId: string;
  account: string;
  currentSpreadPips: number;
  thresholdValuePips: number;
  alertType: "Warning" | "Critical" | "News Spike" | "Broker Spike" | "Symbol Spike" | "Execution Blocked";
  severity: "Info" | "Warning" | "Critical";
  executionBlocked: boolean;
  rootCause: string;
  aiExplanation: string;
  resolutionStatus: "Resolved" | "Unresolved";
  resolvedAt: string | null;
};

export type SpreadLogEntry = {
  id: string;
  timestamp: string;
  eventType: string;
  severity: "Info" | "Warning" | "Critical";
  symbol: string;
  normalizedSymbol: string;
  brokerId: string;
  accountId: string;
  message: string;
  statusBefore: string;
  statusAfter: string;
  currentSpreadPips: number;
  executionAllowed: boolean;
  actionTaken: string;
};

export type AiSpreadDiagnostic = {
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

export type SpreadMonitorSummaryResponse = {
  meta: { timestamp: string; currentRole: Mt5Role; streamEndpoint: string };
  kpis: Array<{ label: string; value: string; status: "Healthy" | "Watch" | "Degraded" | "Critical"; detail: string; updatedAt: string }>;
  spreadRiskScore: ScoreResult;
};

export type SpreadsResponse = {
  meta: { timestamp: string; total: number; page: number; pageSize: number };
  spreads: SpreadSnapshot[];
};

export type SymbolSpreadResponse = {
  meta: { timestamp: string };
  symbol: string;
  normalizedSymbol: string;
  rows: SpreadSnapshot[];
  trend: SpreadTrendPoint[];
  latestAlerts: SpreadAlert[];
};

export type BrokerComparisonRow = {
  normalizedSymbol: string;
  brokers: Array<{ brokerId: string; broker: string; currentSpreadPips: number; averageSpreadPips: number }>;
  lowestSpreadBroker: string;
  highestSpreadBroker: string;
  spreadDifferencePips: number;
  bestExecutionBroker: string;
  worstExecutionBroker: string;
  recommendation: string;
};

export type BrokerComparisonResponse = { meta: { timestamp: string; total: number }; comparisons: BrokerComparisonRow[] };
export type TrendsResponse = { meta: { timestamp: string; total: number }; points: SpreadTrendPoint[] };
export type ThresholdsResponse = { meta: { timestamp: string; total: number }; thresholds: SpreadThreshold[] };

export type AlertsResponse = { meta: { timestamp: string; total: number }; alerts: SpreadAlert[] };
export type LogsResponse = { meta: { timestamp: string; total: number }; logs: SpreadLogEntry[] };
export type AiDiagnosticsResponse = { meta: { timestamp: string; total: number }; diagnostics: AiSpreadDiagnostic[] };

export type WorkflowResponse = { meta: { timestamp: string }; workflow: SpreadWorkflowNode[] };

export type ActionResponse = {
  meta: { timestamp: string };
  ok: boolean;
  message: string;
  affected?: string[];
};

export type ThresholdCreateRequest = Omit<SpreadThreshold, "id" | "createdAt" | "updatedAt">;
export type ThresholdUpdateRequest = Partial<Omit<SpreadThreshold, "id" | "createdAt" | "updatedAt">>;

export type SpreadMonitorAudit = AuditRecord;


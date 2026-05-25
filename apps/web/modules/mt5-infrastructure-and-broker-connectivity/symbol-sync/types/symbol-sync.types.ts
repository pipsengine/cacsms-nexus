import type { AuditRecord, Mt5Role } from "../../mt5-control-center/types/mt5-control-center.types";

export type SymbolTone = "Healthy" | "Watch" | "Degraded" | "Critical" | "Offline" | "Syncing" | "Inactive";
export type SymbolSeverity = "Info" | "Warning" | "Critical";

export type SyncedSymbol = {
  id: string;
  brokerId: string;
  brokerName: string;
  serverName: string;
  brokerSymbol: string;
  normalizedSymbol: string;
  assetClass: string;
  digits: number;
  contractSize: number;
  tickSize: number;
  tickValue: number;
  minLot: number;
  maxLot: number;
  lotStep: number;
  spread: number;
  rollingSpread: number;
  tradingAllowed: boolean;
  dataFeedActive: boolean;
  marketOpen: boolean;
  mappingStatus: SymbolTone;
  feedStatus: SymbolTone;
  lastTickAt: string;
  lastSyncAt: string;
  tickDelaySeconds: number;
  gapCount: number;
  mismatchReason?: string;
  riskLevel: SymbolTone;
};

export type SymbolIssue = {
  id: string;
  symbolId: string;
  brokerName: string;
  brokerSymbol: string;
  normalizedSymbol: string;
  issueType: "Unknown Symbol" | "Mapping Mismatch" | "Duplicate Mapping" | "Spread Anomaly" | "Delayed Tick" | "Missing Tick" | "Trading Disabled";
  severity: SymbolSeverity;
  detectedAt: string;
  detail: string;
  recommendedAction: string;
  resolved: boolean;
};

export type SymbolDiagnostic = {
  id: string;
  symbolId: string;
  issue: string;
  affectedInstrument: string;
  severity: SymbolSeverity;
  rootCause: string;
  tradingImpact: string;
  recommendation: string;
  confidenceScore: number;
  autoFixEligible: boolean;
  autoFixStatus: "Available" | "Approval Required" | "Running" | "Completed" | "Blocked";
  escalationRequired: boolean;
  createdAt: string;
};

export type SymbolWorkflowNode = {
  title: string;
  status: SymbolTone;
  symbolCount: number;
  failureCount: number;
  averageDelayMs: number;
  lastCheckedAt: string;
  aiRecommendation?: string;
};

export type FeedMetric = {
  id: string;
  brokerName: string;
  normalizedSymbol: string;
  tickDelaySeconds: number;
  spread: number;
  rollingSpread: number;
  gapCount: number;
  feedStatus: SymbolTone;
  lastTickAt: string;
};

export type SymbolHealthScore = {
  score: number;
  rating: "Excellent" | "Healthy" | "Degraded" | "High Risk" | "Critical";
  factors: Record<string, number>;
};

export type SymbolSyncResponse = {
  meta: { timestamp: string; currentRole: Mt5Role; streamEndpoint: string; monitoringMode: "Autonomous Symbol Validation" };
  kpis: Array<{ label: string; value: string; status: SymbolTone; detail: string; updatedAt: string }>;
  health: SymbolHealthScore;
  workflow: SymbolWorkflowNode[];
  symbols: SyncedSymbol[];
  issues: SymbolIssue[];
  feedMetrics: FeedMetric[];
  diagnostics: SymbolDiagnostic[];
  audits: AuditRecord[];
  permissions: {
    role: Mt5Role;
    canSync: boolean;
    canValidate: boolean;
    canRemap: boolean;
    canDiagnostics: boolean;
    canAutoRemediate: boolean;
  };
};

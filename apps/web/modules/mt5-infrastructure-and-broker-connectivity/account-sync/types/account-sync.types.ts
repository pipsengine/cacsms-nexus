import type { AuditRecord, Mt5Role } from "../../mt5-control-center/types/mt5-control-center.types";

export type AccountTone = "Healthy" | "Watch" | "Degraded" | "Critical" | "Offline" | "Syncing" | "Inactive";
export type AccountSeverity = "Info" | "Warning" | "Critical";
export type ReconciliationStatus = "Matched" | "Minor Difference" | "Material Difference" | "Failed" | "Requires Review";

export type SyncedAccount = {
  id: string; accountId: string; brokerId: string; brokerName: string; terminalId: string; terminalName: string; accountLogin: string; accountName: string;
  serverName: string; accountType: string; currency: string; leverage: string; accountGroup: string; accountStatus: AccountTone;
  balance: number; equity: number; credit: number; margin: number; freeMargin: number; marginLevel: number; floatingProfitLoss: number; realizedProfitLoss: number;
  dailyProfitLoss: number; weeklyProfitLoss: number; monthlyProfitLoss: number; tradingAllowed: boolean; expertTradingAllowed: boolean; longTradesAllowed: boolean;
  shortTradesAllowed: boolean; hedgeModeEnabled: boolean; minimumLotCompatible: boolean; symbolPermissionsValid: boolean; riskEngineStatus: AccountTone; eaBridgeLinked: boolean;
  openPositionsCount: number; pendingOrdersCount: number; syncStatus: AccountTone; lastSyncAt: string; lastSuccessfulSyncAt: string; lastFailedSyncAt?: string;
  syncDelaySeconds: number; averageSyncDurationMs: number; syncRetryCount: number; syncReliabilityScore: number; dataMismatchCount: number; riskLevel: AccountTone; lastError?: string;
};

export type AccountPosition = {
  id: string; accountId: string; accountLogin: string; brokerId: string; terminalId: string; positionTicket: string; symbol: string; normalizedSymbol: string;
  direction: "Buy" | "Sell"; volume: number; entryPrice: number; currentPrice: number; stopLoss: number; takeProfit: number; profitLoss: number; swap: number;
  commission: number; openTime: string; syncStatus: AccountTone; lastSyncAt: string;
};

export type AccountPendingOrder = {
  id: string; accountId: string; accountLogin: string; brokerId: string; terminalId: string; orderTicket: string; symbol: string; normalizedSymbol: string;
  orderType: string; direction: "Buy" | "Sell"; volume: number; price: number; stopLoss: number; takeProfit: number; expiryTime: string;
  orderStatus: "Pending" | "Filled" | "Cancelled"; syncStatus: AccountTone; lastSyncAt: string;
};

export type AccountReconciliation = {
  id: string; accountId: string; accountLogin: string; mt5Balance: number; nexusBalance: number; lastSyncedBalance: number; balanceDifference: number;
  mt5Equity: number; nexusEquity: number; equityDifference: number; mt5Margin: number; nexusMargin: number; marginDifference: number;
  mt5PositionCount: number; nexusPositionCount: number; positionCountDifference: number; mt5PendingOrderCount: number; nexusPendingOrderCount: number;
  pendingOrderCountDifference: number; profitLossDifference: number; reconciliationStatus: ReconciliationStatus; requiredAction: string; reconciledBy: string; reconciledAt: string;
};

export type AccountSyncLog = {
  id: string; accountId: string; accountLogin: string; brokerName: string; syncType: "Balance Sync" | "Position Sync" | "Order Sync" | "Permission Sync" | "Reconciliation" | "Snapshot";
  syncStatus: "Successful" | "Failed" | "Pending" | "Retried"; durationMs: number; recordsProcessed: number; errorCode?: string; errorMessage?: string;
  retryCount: number; resolved: boolean; aiExplanation: string; createdAt: string;
};

export type AccountExposure = {
  id: string; accountId: string; accountLogin: string; symbol: string; normalizedSymbol: string; assetClass: string; longVolume: number; shortVolume: number;
  netVolume: number; notionalExposure: number; marginUsed: number; floatingProfitLoss: number; exposureRiskScore: number; correlationGroup: string; measuredAt: string;
};

export type AccountDiagnostic = {
  id: string; accountId: string; affectedAccount: string; issue: string; severity: AccountSeverity; rootCause: string; tradingImpact: string; recommendation: string;
  confidenceScore: number; autoFixEligible: boolean; autoFixStatus: "Available" | "Approval Required" | "Running" | "Completed" | "Blocked"; escalationRequired: boolean; createdAt: string;
};

export type AccountWorkflowNode = {
  title: string; status: AccountTone; accountCount: number; failureCount: number; averageDelayMs: number; lastSyncAt: string; aiRecommendation?: string;
};

export type AccountScore = {
  score: number; rating: "Excellent" | "Healthy" | "Degraded" | "High Risk" | "Critical"; factors: Record<string, number>;
};

export type ExposureSummary = {
  accountId: string; totalExposure: number; marginUtilization: number; floatingDrawdown: number; concentrationRisk: number; correlatedExposureWarning: boolean;
  longExposure: number; shortExposure: number; riskScore: number; riskLevel: "Low" | "Moderate" | "Elevated" | "High" | "Critical"; emergencyRiskFlag: boolean;
};

export type AccountSyncResponse = {
  meta: { timestamp: string; currentRole: Mt5Role; streamEndpoint: string; monitoringMode: "Autonomous Account Reconciliation" };
  kpis: Array<{ label: string; value: string; status: AccountTone; detail: string; updatedAt: string }>;
  workflow: AccountWorkflowNode[]; accounts: SyncedAccount[]; positions: AccountPosition[]; orders: AccountPendingOrder[]; reconciliations: AccountReconciliation[];
  logs: AccountSyncLog[]; exposures: AccountExposure[]; exposureSummaries: ExposureSummary[]; diagnostics: AccountDiagnostic[]; audits: AuditRecord[];
  permissions: { role: Mt5Role; canSync: boolean; canDiagnostics: boolean; canReconcile: boolean; canTradeControl: boolean; canReviewExceptions: boolean; canAutoRemediate: boolean };
};

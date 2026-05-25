export type TradeDirection = "Buy" | "Sell";
export type OrderType = "Market" | "Limit" | "Stop";
export type TradeStatus = "Open" | "Closed" | "Pending" | "Canceled" | "Partially Filled";

export type SyncStatus = "Synced" | "Pending Sync" | "Failed Sync" | "Frozen";
export type StateMatchStatus =
  | "Matched"
  | "Minor Difference"
  | "Material Difference"
  | "Missing in Nexus"
  | "Missing in MT5"
  | "Requires Review";

export type RiskLevel = "Low" | "Moderate" | "High" | "Critical";

export type Severity = "Info" | "Warning" | "Critical" | "Resolved";

export type Role = "Super Admin" | "Infrastructure Admin" | "Trading Admin" | "Risk Manager" | "Analyst" | "Viewer";

export type TradeSyncKpis = {
  totalActiveTrades: number;
  syncedTrades: number;
  pendingSync: number;
  failedSync: number;
  tradeStateMismatches: number;
  openPositions: number;
  pendingOrders: number;
  closedTradesToday: number;
  partialFills: number;
  modificationEvents: number;
  averageSyncDelaySeconds: number;
  tradeSyncHealthScore: TradeSyncScore;
};

export type TradeSyncWorkflowStepKey =
  | "orderRouted"
  | "mt5TicketCreated"
  | "executionFeedbackReceived"
  | "positionSynced"
  | "slTpSynced"
  | "modificationSynced"
  | "partialFillChecked"
  | "closeEventSynced"
  | "plReconciled"
  | "auditLogged";

export type TradeSyncWorkflowStep = {
  key: TradeSyncWorkflowStepKey;
  label: string;
  status: "Operational" | "Degraded" | "Blocked" | "Monitoring";
  tradeCount: number;
  failedCount: number;
  averageDelaySeconds: number;
  lastEventTime: string;
  aiRecommendation: string;
};

export type TradeSyncScore = {
  score: number;
  explanation: string;
  factors: Record<string, number>;
  penalties: Record<string, number>;
};

export type TradeSyncSummaryResponse = {
  meta: {
    timestamp: string;
    environment: "Development" | "Staging" | "Production";
    frozen: boolean;
  };
  kpis: TradeSyncKpis;
  workflow: TradeSyncWorkflowStep[];
};

export type TradeSyncTrade = {
  tradeId: string;
  mt5Ticket: string | null;
  orderId: string | null;
  signalId: string | null;
  strategyId: string | null;
  account: string;
  broker: string;
  terminal: string;
  eaInstance: string;
  symbol: string;
  normalizedSymbol: string;
  direction: TradeDirection;
  orderType: OrderType;
  volumeRequested: number;
  volumeFilled: number;
  entryPrice: number;
  currentPrice: number;
  stopLoss: number | null;
  takeProfit: number | null;
  closePrice: number | null;
  tradeStatus: TradeStatus;
  nexusState: string;
  mt5State: string;
  syncStatus: SyncStatus;
  stateMatchStatus: StateMatchStatus;
  floatingProfitLoss: number;
  realizedProfitLoss: number;
  swap: number;
  commission: number;
  netProfitLoss: number;
  marginUsed: number;
  openTime: string;
  closeTime: string | null;
  lastMt5UpdateAt: string;
  lastNexusUpdateAt: string;
  lastSyncAt: string;
  syncDelaySeconds: number;
  riskLevel: RiskLevel;
};

export type TradeSyncTradesResponse = {
  meta: { timestamp: string; total: number; page: number; pageSize: number };
  trades: TradeSyncTrade[];
};

export type TradeLifecycleEvent = {
  id: string;
  tradeId: string;
  mt5Ticket: string | null;
  eventType:
    | "Signal generated"
    | "Order approved"
    | "Order routed"
    | "MT5 command delivered"
    | "MT5 ticket created"
    | "Partial fill received"
    | "Full fill confirmed"
    | "SL/TP set"
    | "Modification received"
    | "Trade closed"
    | "Profit/loss reconciled"
    | "Audit completed";
  source: "Nexus" | "MT5" | "Broker" | "Risk Engine" | "AI Orchestrator";
  statusBefore: string;
  statusAfter: string;
  message: string;
  latencyMs: number;
  result: "Ok" | "Warn" | "Fail";
  timestamp: string;
};

export type TradeModification = {
  id: string;
  modificationId: string;
  tradeId: string;
  mt5Ticket: string | null;
  modificationType:
    | "SL update"
    | "TP update"
    | "Position scaling"
    | "Partial close"
    | "Full close"
    | "Order cancellation"
    | "Order expiry"
    | "Trailing stop adjustment"
    | "Break-even movement";
  oldValue: string;
  newValue: string;
  source: "Nexus" | "MT5" | "Broker" | "Operator";
  status: "Applied" | "Pending" | "Failed";
  appliedAt: string;
  syncedAt: string | null;
  syncResult: "Ok" | "Warn" | "Fail";
};

export type TradeReconciliationComparison = {
  key:
    | "state"
    | "volume"
    | "entryPrice"
    | "stopLoss"
    | "takeProfit"
    | "closePrice"
    | "profitLoss"
    | "commissionSwap"
    | "orderStatus";
  label: string;
  nexusValue: string;
  mt5Value: string;
  difference: string;
  status: StateMatchStatus;
  requiredAction: string;
};

export type TradeReconciliationResponse = {
  meta: { timestamp: string };
  tradeId: string | null;
  comparisons: TradeReconciliationComparison[];
};

export type TradeSyncLogEntry = {
  id: string;
  timestamp: string;
  tradeId: string | null;
  mt5Ticket: string | null;
  account: string | null;
  broker: string | null;
  exceptionType: string;
  severity: "Info" | "Warning" | "Critical";
  errorMessage: string;
  rootCause: string;
  retryCount: number;
  resolutionStatus: "Resolved" | "Unresolved";
  aiExplanation: string;
};

export type TradeSyncLogsResponse = {
  meta: { timestamp: string; total: number };
  logs: TradeSyncLogEntry[];
};

export type AiTradeSyncDiagnostic = {
  id: string;
  issue: string;
  affectedTradeId: string | null;
  affectedTicket: string | null;
  severity: "Info" | "Warning" | "Critical";
  rootCause: string;
  tradingImpact: string;
  recommendedAction: string;
  autoFixEligible: boolean;
  confidenceScore: number;
};

export type AiDiagnosticsResponse = {
  meta: { timestamp: string };
  diagnostics: AiTradeSyncDiagnostic[];
};

export type ActionResponse = {
  meta: { timestamp: string; frozen: boolean };
  ok: boolean;
  message: string;
  affectedTradeIds?: string[];
};


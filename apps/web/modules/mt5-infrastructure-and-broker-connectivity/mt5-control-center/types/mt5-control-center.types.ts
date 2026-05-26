export type Mt5Status = "Healthy" | "Warning" | "Critical" | "Offline" | "Syncing" | "Inactive";
export type Mt5Severity = "Info" | "Warning" | "Critical";
export type Mt5Role = "Super Admin" | "Infrastructure Admin" | "Trading Admin" | "Risk Manager" | "Analyst" | "Read-Only Viewer";

export type Terminal = {
  id: string;
  terminalUuid: string;
  terminalName: string;
  brokerId: string;
  brokerName: string;
  serverName: string;
  accountLogin: string;
  accountType: string;
  terminalVersion: string;
  hostMachine: string;
  status: Mt5Status;
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
  latencyMs: number;
  uptimeSeconds: number;
  lastHeartbeatAt: string;
  autoRestartEnabled: boolean;
  tradingEnabled: boolean;
};

export type TerminalOnboardingInput = {
  terminalUuid?: string;
  terminalName: string;
  brokerId: string;
  brokerName: string;
  serverName: string;
  accountLogin: string;
  accountName: string;
  accountType: string;
  currency: string;
  leverage: string;
  terminalVersion: string;
  hostMachine: string;
  ipAddress?: string;
  operatingSystem?: string;
  region?: string;
  timezone?: string;
  terminalPath?: string;
  mt5DataPath?: string;
  eaName: string;
  symbolScope?: string[];
  confirmed?: boolean;
};

export type TerminalOnboardingReceipt = {
  terminal: Terminal;
  accountId: string;
  eaInstanceId: string;
  ingestionToken: string;
  signingSecret: string;
  nexusBaseUrl: string;
  state: "Awaiting Verified Heartbeat";
};

export type Broker = {
  id: string;
  brokerName: string;
  brokerCode: string;
  mt5ServerName: string;
  serverRegion: string;
  connectionMode: string;
  status: Mt5Status;
  averageLatencyMs: number;
  averageSpread: number;
  executionQualityScore: number;
  dataFeedQualityScore: number;
  slippageRate: number;
  requoteRate: number;
  failedOrderRate: number;
  uptimePercent: number;
  loginHealth: Mt5Status;
  lastIncident: string | null;
};

export type Account = {
  id: string;
  brokerId: string;
  brokerName: string;
  terminalId: string;
  accountLogin: string;
  accountType: string;
  currency: string;
  balance: number;
  equity: number;
  margin: number;
  freeMargin: number;
  leverage: string;
  tradeAllowed: boolean;
  syncStatus: Mt5Status;
  lastSyncAt: string;
  status: Mt5Status;
};

export type SymbolMapping = {
  id: string;
  brokerId: string;
  symbol: string;
  brokerSymbol: string;
  normalizedSymbol: string;
  assetClass: string;
  digits: number;
  contractSize: number;
  tickValue: number;
  spread: number;
  normalSpread: number;
  tradingAllowed: boolean;
  dataFeedActive: boolean;
  mappingStatus: Mt5Status;
  lastTickAt: string;
};

export type ConnectionEvent = {
  id: string;
  terminalId?: string;
  brokerId?: string;
  accountId?: string;
  eventType: string;
  severity: Mt5Severity;
  statusBefore?: Mt5Status;
  statusAfter?: Mt5Status;
  message: string;
  rootCause: string;
  autoResolved: boolean;
  resolvedAt?: string;
  createdAt: string;
};

export type ExecutionSample = {
  id: string;
  brokerId: string;
  accountId: string;
  symbol: string;
  orderType: string;
  requestedPrice: number;
  executedPrice?: number;
  slippagePoints: number;
  executionTimeMs: number;
  rejectionReason?: string;
  requoteDetected: boolean;
  spreadAtExecution: number;
  liquidityScore: number;
  createdAt: string;
};

export type AiDiagnostic = {
  id: string;
  issue: string;
  affectedComponent: string;
  severity: Mt5Severity;
  severityScore: number;
  rootCauseAnalysis: string;
  businessImpact: string;
  recommendation: string;
  autoRemediationAvailable: boolean;
  autoRemediationStatus: "Available" | "Running" | "Completed" | "Approval Required";
  confidenceScore: number;
  escalationRequired: boolean;
  createdAt: string;
};

export type WorkflowNode = {
  id: string;
  title: string;
  status: Mt5Status;
  lastCheckedAt: string;
  failureReason?: string;
  aiRecommendation: string;
};

export type AuditRecord = {
  id: string;
  userId: string;
  action: string;
  module: string;
  entityId: string;
  oldValue?: unknown;
  newValue?: unknown;
  ipAddress: string;
  userAgent: string;
  timestamp: string;
};

export type ScoreResult = {
  score: number;
  rating: "Excellent" | "Healthy" | "Degraded" | "High Risk" | "Critical";
  factors: Record<string, number>;
};

export type Mt5ControlCenterResponse = {
  meta: {
    timestamp: string;
    streamEndpoint: string;
    currentRole: Mt5Role;
    monitoringMode: "Autonomous";
  };
  kpis: Array<{ label: string; value: string; status: Mt5Status; detail: string }>;
  connectionHealth: ScoreResult;
  workflow: WorkflowNode[];
  terminals: Terminal[];
  brokers: Broker[];
  accounts: Account[];
  symbols: SymbolMapping[];
  executionQuality: {
    averageExecutionMs: number;
    rejectionRate: number;
    requoteRate: number;
    averageSlippagePoints: number;
    delayedTicks: number;
    marketDataGaps: number;
    fillQualityScore: number;
    brokerMetrics: Array<{ brokerId: string; brokerName: string; latencyMs: number; executionMs: number; slippage: number; rejected: number }>;
  };
  brokerRanking: {
    bestForExecution: string;
    bestForDataQuality: string;
    riskyBroker: string;
    requiresMonitoring: string[];
  };
  diagnostics: AiDiagnostic[];
  incidents: ConnectionEvent[];
  permissions: {
    role: Mt5Role;
    canRegisterTerminal: boolean;
    canRegisterBroker: boolean;
    canRestart: boolean;
    canSync: boolean;
    canDisableTrading: boolean;
    canEmergencyShutdown: boolean;
  };
};

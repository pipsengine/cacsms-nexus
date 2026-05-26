import type { AuditRecord, Mt5Role } from "../../mt5-control-center/types/mt5-control-center.types";

export type BridgeTone = "Healthy" | "Watch" | "Degraded" | "Critical" | "Offline" | "Syncing" | "Inactive";
export type BridgeSeverity = "Info" | "Warning" | "Critical";
export type TokenRisk = "Low" | "Watch" | "Medium" | "High" | "Critical";
export type TerminalMessageType = "Heartbeat" | "Account Snapshot" | "Position Update" | "Pending Order Update" | "Command Poll" | "Trade Execution Result";

export type SignedBridgeEnvelope = {
  instanceId: string;
  messageType: TerminalMessageType;
  timestamp: string;
  nonce: string;
  payloadJson: string;
  signature: string;
};

export type TerminalHeartbeatPayload = {
  terminalName: string;
  accountLogin: string;
  brokerConnected: boolean;
  marketDataActive: boolean;
  tradingEnabled: boolean;
  latencyMs: number;
};

export type TerminalAccountSnapshotPayload = {
  accountLogin: string;
  balance: number;
  equity: number;
  credit: number;
  margin: number;
  freeMargin: number;
  marginLevel: number;
  floatingProfitLoss: number;
  openPositionsCount: number;
  pendingOrdersCount: number;
  tradingAllowed: boolean;
  expertTradingAllowed: boolean;
};

export type TerminalExecutionFeedbackPayload = {
  commandUuid: string;
  status: "Delivered" | "Executed" | "Rejected";
  responseTimeMs: number;
  rejectionReason?: string;
};

export type TerminalPositionRecord = {
  positionTicket: string;
  symbol: string;
  direction: "Buy" | "Sell";
  volume: number;
  entryPrice: number;
  currentPrice: number;
  stopLoss: number;
  takeProfit: number;
  profitLoss: number;
  swap: number;
  commission: number;
  openTime: string;
};

export type TerminalPositionUpdatePayload = {
  schemaVersion: "1.0";
  accountLogin: string;
  positions: TerminalPositionRecord[];
};

export type TerminalPendingOrderRecord = {
  orderTicket: string;
  symbol: string;
  orderType: string;
  direction: "Buy" | "Sell";
  volume: number;
  price: number;
  stopLoss: number;
  takeProfit: number;
  createdTime: string;
  expiryTime?: string;
};

export type TerminalPendingOrderUpdatePayload = {
  schemaVersion: "1.0";
  accountLogin: string;
  orders: TerminalPendingOrderRecord[];
};

export type EaPairingReceipt = {
  eaInstanceId: string;
  terminalName: string;
  accountLogin: string;
  ingestionToken: string;
  signingSecret: string;
  nexusBaseUrl: string;
  state: "Reissued Pairing Credentials";
};

export type EaInstance = {
  id: string;
  eaInstanceUuid: string;
  eaName: string;
  terminalId: string;
  terminalName: string;
  brokerId: string;
  brokerName: string;
  accountId: string;
  accountLogin: string;
  symbolScope: string[];
  eaVersion: string;
  buildNumber: number;
  bridgeTokenHash: string;
  tokenStatus: "Valid" | "Expiring" | "Rotated" | "Revoked" | "Compromised";
  tokenCreatedAt: string;
  failedAuthenticationAttempts: number;
  knownIpAddress: string;
  currentIpAddress: string;
  knownDeviceFingerprint: boolean;
  activeSessionCount: number;
  permissionMismatch: boolean;
  connectionStatus: BridgeTone;
  heartbeatStatus: BridgeTone;
  lastHeartbeatAt: string;
  messageCount: number;
  failedMessageCount: number;
  averageLatencyMs: number;
  tradingChannelEnabled: boolean;
  riskLevel: BridgeTone;
  lastError: string | null;
  updatedAt: string;
};

export type BridgeSession = {
  id: string;
  sessionUuid: string;
  eaInstanceId: string;
  eaInstanceName: string;
  terminalName: string;
  brokerName: string;
  accountLogin: string;
  ipAddress: string;
  protocol: "WebSocket" | "HTTPS Signed Push";
  authStatus: "Authenticated" | "Rejected" | "Expiring";
  connectionStartedAt: string;
  lastMessageAt: string;
  sessionDurationSeconds: number;
  messageRatePerMinute: number;
  latencyMs: number;
  status: BridgeTone;
};

export type BridgeMessage = {
  id: string;
  messageUuid: string;
  eaInstanceId: string;
  sessionId: string;
  messageType: "Heartbeat" | "Tick Data" | "Candle Data" | "Account Snapshot" | "Position Update" | "Pending Order Update" | "Command Poll" | "Trade Request" | "Trade Execution Result" | "Error Report" | "Risk Alert";
  source: string;
  destination: string;
  payloadHash: string;
  schemaVersion: string;
  nonce: string;
  signed: boolean;
  status: "Delivered" | "Processing" | "Failed" | "Retrying" | "Rejected";
  retryCount: number;
  processingTimeMs: number;
  failureReason?: string;
  createdAt: string;
  deliveredAt?: string;
};

export type TradeCommand = {
  id: string;
  commandUuid: string;
  eaInstanceId: string;
  accountId: string;
  accountLogin: string;
  symbol: string;
  commandType: string;
  direction: "Buy" | "Sell";
  volume: number;
  requestedPrice: number;
  stopLoss?: number;
  takeProfit?: number;
  riskApprovalStatus: "Approved" | "Blocked" | "Review";
  deliveryStatus: "Delivered" | "Blocked" | "Pending";
  executionStatus: "Executed" | "Rejected" | "Pending";
  responseTimeMs: number;
  rejectionReason?: string;
  signalTimestamp: string;
  strategyId: string;
  createdAt: string;
  executedAt?: string;
};

export type BridgeLog = {
  id: string;
  eaInstanceId: string;
  eaInstanceName: string;
  terminalName: string;
  accountLogin: string;
  logType: "Authentication" | "Token" | "Payload" | "Schema" | "Timeout" | "Duplicate" | "Connection" | "Broker" | "Risk";
  severity: BridgeSeverity;
  message: string;
  technicalDetails: string;
  resolved: boolean;
  createdAt: string;
};

export type BridgeDiagnostic = {
  id: string;
  eaInstanceId: string;
  affectedComponent: string;
  issue: string;
  severity: BridgeSeverity;
  rootCause: string;
  businessImpact: string;
  recommendation: string;
  confidenceScore: number;
  autoFixEligible: boolean;
  autoFixStatus: "Available" | "Blocked" | "Approval Required" | "Running" | "Completed";
  escalationRequired: boolean;
  createdAt: string;
};

export type BridgeWorkflowNode = {
  title: string;
  status: BridgeTone;
  currentCount: number;
  failureCount: number;
  averageDelayMs: number;
  lastEventAt: string;
  aiRecommendation?: string;
};

export type BridgeScore = {
  score: number;
  rating: "Excellent" | "Healthy" | "Degraded" | "High Risk" | "Critical";
  factors: Record<string, number>;
};

export type EaBridgeResponse = {
  meta: { timestamp: string; currentRole: Mt5Role; streamEndpoint: string; monitoringMode: "Autonomous Secure Bridge" };
  kpis: Array<{ label: string; value: string; status: BridgeTone; detail: string; updatedAt: string }>;
  bridgeHealth: BridgeScore;
  workflow: BridgeWorkflowNode[];
  instances: EaInstance[];
  sessions: BridgeSession[];
  messages: BridgeMessage[];
  commands: TradeCommand[];
  logs: BridgeLog[];
  diagnostics: BridgeDiagnostic[];
  audits: AuditRecord[];
  permissions: {
    role: Mt5Role;
    canSync: boolean;
    canDiagnostics: boolean;
    canRestart: boolean;
    canRotateToken: boolean;
    canReissuePairing: boolean;
    canTradeControl: boolean;
    canRebindTerminal: boolean;
    canEmergencyDisable: boolean;
    canAutoRemediate: boolean;
  };
};

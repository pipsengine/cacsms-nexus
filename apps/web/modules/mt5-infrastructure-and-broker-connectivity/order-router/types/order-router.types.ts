import type { AuditRecord, Mt5Role } from "../../mt5-control-center/types/mt5-control-center.types";

export type RouterTone = "Healthy" | "Watch" | "Degraded" | "Critical" | "Offline" | "Paused" | "Pending";
export type RouterSeverity = "Info" | "Warning" | "Critical";
export type ValidationStatus = "Passed" | "Failed" | "Pending";
export type RouteStatus = "Pending" | "Routed" | "Delivered" | "Executed" | "Failed" | "Cancelled" | "Blocked" | "Retried";

export type OrderRoute = {
  id: string;
  routeUuid: string;
  orderId: string;
  signalId: string;
  strategyId: string;
  strategyName: string;
  sourceEngine: string;
  accountId: string;
  accountLogin: string;
  brokerId: string;
  brokerName: string;
  mt5Server: string;
  terminalId: string;
  terminalName: string;
  eaInstanceId: string;
  eaInstanceName: string;
  executionChannel: string;
  symbol: string;
  normalizedSymbol: string;
  brokerSymbol: string;
  direction: "Buy" | "Sell";
  orderType: "Market" | "Limit" | "Stop";
  volume: number;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  expiryTime?: string;
  timeInForce: string;
  requestedExecutionTime: string;
  routingPriority: "Critical" | "High" | "Normal";
  fallbackRouteAvailable: boolean;
  signalValidationStatus: ValidationStatus;
  riskStatus: ValidationStatus;
  accountReadinessStatus: ValidationStatus;
  brokerReadinessStatus: ValidationStatus;
  symbolMappingStatus: ValidationStatus;
  duplicateCheckStatus: ValidationStatus;
  marginCheckStatus: ValidationStatus;
  marketConditionStatus: ValidationStatus;
  routingStatus: RouteStatus;
  deliveryStatus: "Pending" | "Delivered" | "Failed" | "Blocked" | "Cancelled";
  executionStatus: "Pending" | "Executed" | "Rejected" | "Not Sent" | "Cancelled";
  routingLatencyMs: number;
  executionResponseTimeMs: number;
  failureReason?: string;
  mt5Ticket?: string;
  bridgeCommandUuid?: string;
  createdAt: string;
  updatedAt: string;
};

export type StrategySignalInput = {
  signalId?: string;
  strategyId?: string;
  strategyName?: string;
  sourceEngine?: string;
  accountLogin?: string;
  eaInstanceId?: string;
  symbol: string;
  direction: "Buy" | "Sell";
  orderType?: "Market" | "Limit" | "Stop";
  volume: number;
  entryPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  routingPriority?: "Critical" | "High" | "Normal";
};

export type StrategySignalResult = {
  ok: boolean;
  routeId?: string;
  orderId?: string;
  bridgeCommandUuid?: string;
  routingStatus?: RouteStatus;
  deliveryStatus?: OrderRoute["deliveryStatus"];
  executionStatus?: OrderRoute["executionStatus"];
  blocked?: boolean;
  blockReason?: string;
  message: string;
};

export type RoutingChannel = {
  id: string;
  channelUuid: string;
  eaInstanceId: string;
  eaInstanceName: string;
  terminalName: string;
  brokerName: string;
  accountLogin: string;
  symbolScope: string[];
  channelStatus: RouterTone;
  tradingEnabled: boolean;
  messageLatencyMs: number;
  commandSuccessRate: number;
  queueBacklogCount: number;
  lastCommandAt: string;
  riskLevel: RouterTone;
};

export type BlockedOrder = {
  id: string;
  orderId: string;
  signalId: string;
  accountLogin: string;
  brokerName: string;
  symbol: string;
  direction: "Buy" | "Sell";
  volume: number;
  blockReason: string;
  riskRuleTriggered: string;
  riskSeverity: RouterSeverity;
  requiredAction: string;
  aiExplanation: string;
  resolved: boolean;
  resolvedAt?: string;
  createdAt: string;
};

export type ExecutionFeedback = {
  id: string;
  routeId: string;
  orderId: string;
  accountLogin: string;
  brokerName: string;
  symbol: string;
  commandSentAt: string;
  deliveredAt?: string;
  executedAt?: string;
  mt5Ticket?: string;
  requestedPrice: number;
  executedPrice?: number;
  slippagePoints?: number;
  executionTimeMs: number;
  mt5ResponseCode: string;
  responseMessage: string;
  executionStatus: "Delivered" | "Executed" | "Rejected" | "Missing" | "Pending";
};

export type RouterLog = {
  id: string;
  routeId: string;
  orderId: string;
  eventType: RouteStatus | "Validation" | "Diagnostics" | "Emergency Stop" | "Routing State";
  severity: RouterSeverity;
  sourceModule: string;
  message: string;
  actionTaken: string;
  result: string;
  resolved: boolean;
  resolvedAt?: string;
  createdAt: string;
};

export type RouterDiagnostic = {
  id: string;
  routeId?: string;
  orderId?: string;
  issue: string;
  issueType: string;
  affectedRoute: string;
  severity: RouterSeverity;
  rootCause: string;
  tradingImpact: string;
  recommendation: string;
  confidenceScore: number;
  autoFixEligible: boolean;
  autoFixStatus: "Available" | "Blocked" | "Approval Required" | "Running" | "Completed";
  escalationRequired: boolean;
  createdAt: string;
};

export type RouterWorkflowNode = {
  title: string;
  status: RouterTone;
  orderCount: number;
  failureCount: number;
  averageDelayMs: number;
  lastProcessedOrder: string;
  aiRecommendation?: string;
};

export type RouterHealth = {
  score: number;
  rating: "Excellent" | "Healthy" | "Degraded" | "High Risk" | "Critical";
  factors: Record<string, number>;
};

export type RouterResponse = {
  meta: {
    timestamp: string;
    currentRole: Mt5Role;
    streamEndpoint: string;
    monitoringMode: "Autonomous Audited Routing";
    routingPaused: boolean;
    emergencyStopActive: boolean;
  };
  kpis: Array<{ label: string; value: string; status: RouterTone; detail: string; updatedAt: string }>;
  health: RouterHealth;
  workflow: RouterWorkflowNode[];
  routes: OrderRoute[];
  channels: RoutingChannel[];
  blockedOrders: BlockedOrder[];
  feedback: ExecutionFeedback[];
  logs: RouterLog[];
  diagnostics: RouterDiagnostic[];
  audits: AuditRecord[];
  permissions: {
    role: Mt5Role;
    canSync: boolean;
    canDiagnostics: boolean;
    canPauseResume: boolean;
    canEmergencyStop: boolean;
    canRetry: boolean;
    canCancel: boolean;
    canRevalidate: boolean;
    canReviewBlocked: boolean;
    canAutoRemediate: boolean;
    canDispatch: boolean;
    canSubmitTest: boolean;
    canSubmitSignal: boolean;
  };
};

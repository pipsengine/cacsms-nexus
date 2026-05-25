import type { Mt5Role, ScoreResult } from "../../mt5-control-center/types/mt5-control-center.types";

export type QueuePriority = "Critical" | "High" | "Normal" | "Low";

export type QueueStatus =
  | "Pending"
  | "Validated"
  | "Processing"
  | "Routed"
  | "Executed"
  | "Failed"
  | "Retried"
  | "Cancelled"
  | "Blocked"
  | "Expired";

export type ValidationStatus = "Pending" | "Passed" | "Failed";
export type RiskStatus = "Pending" | "Passed" | "Failed";
export type ReadinessStatus = "Unknown" | "Ready" | "Not Ready" | "Degraded";

export type RoutingStatus = "Unassigned" | "Assigned" | "Reassigned" | "Failed";
export type DeliveryStatus = "Pending" | "Delivered" | "Failed" | "Blocked" | "Cancelled";
export type ExecutionStatus = "Not Sent" | "Pending" | "Executed" | "Rejected" | "Failed";

export type SlaStatus = "Within SLA" | "Nearing Breach" | "Breached" | "Expired";
export type SlaStage =
  | "Validation delay"
  | "Risk gate delay"
  | "Broker readiness delay"
  | "Account readiness delay"
  | "Terminal delay"
  | "EA delivery delay"
  | "Execution feedback delay"
  | "Retry congestion"
  | "Blocked queue buildup";

export type OrderType = "Market" | "Limit" | "Stop";
export type TradeDirection = "Buy" | "Sell";

export type ExecutionQueueItem = {
  id: string;
  queueId: string;
  orderId: string;
  signalId: string;
  strategyId: string;
  sourceEngine: string;
  priority: QueuePriority;
  account: string;
  broker: string;
  terminal: string;
  eaInstance: string;
  symbol: string;
  normalizedSymbol: string;
  brokerSymbol: string;
  direction: TradeDirection;
  orderType: OrderType;
  volume: number;
  entryPrice: number;
  stopLoss: number | null;
  takeProfit: number | null;
  timeInForce: string;
  targetExecutionWindow: string;
  expiryTime: string;
  queueStatus: QueueStatus;
  validationStatus: ValidationStatus;
  riskStatus: RiskStatus;
  accountReadinessStatus: ReadinessStatus;
  brokerReadinessStatus: ReadinessStatus;
  terminalReadinessStatus: ReadinessStatus;
  eaBridgeReadinessStatus: ReadinessStatus;
  symbolMappingStatus: ValidationStatus;
  spreadValidationStatus: ValidationStatus;
  marginValidationStatus: ValidationStatus;
  duplicateCheckStatus: ValidationStatus;
  routingStatus: RoutingStatus;
  deliveryStatus: DeliveryStatus;
  executionStatus: ExecutionStatus;
  retryCount: number;
  maxRetryCount: number;
  queueAgeSeconds: number;
  slaStatus: SlaStatus;
  failureReason?: string;
  nextAction: string;
  createdAt: string;
  updatedAt: string;
  lastRetryAt?: string;
  assignedRoute?: string;
};

export type QueueWorkflowNode = {
  title: string;
  status: "Operational" | "Degraded" | "Blocked" | "Monitoring";
  itemCount: number;
  failedCount: number;
  averageDelaySeconds: number;
  lastProcessedItem: string;
  aiRecommendation?: string;
};

export type QueueLog = {
  id: string;
  queueId: string | "ALL";
  orderId: string | "ALL";
  eventType: string;
  severity: "Info" | "Warning" | "Critical";
  sourceModule: string;
  message: string;
  actionTaken: string;
  result: string;
  createdAt: string;
};

export type QueueException = {
  queueId: string;
  orderId: string;
  account: string;
  broker: string;
  symbol: string;
  status: QueueStatus;
  failureReason: string;
  retryCount: number;
  lastRetryAt?: string;
  retryEligibility: "Eligible" | "Blocked";
  blockReason?: string;
  aiExplanation: string;
  requiredAction: string;
};

export type QueueBottleneck = {
  id: string;
  bottleneckStage: SlaStage;
  affectedCount: number;
  averageDelaySeconds: number;
  severity: "Info" | "Warning" | "Critical";
  rootCause: string;
  recommendedAction: string;
  detectedAt: string;
  resolvedAt?: string;
};

export type QueueSlaPrioritySummary = {
  criticalPriorityQueue: number;
  highPriorityQueue: number;
  normalPriorityQueue: number;
  lowPriorityQueue: number;
  expiredQueueItems: number;
  slaBreachedQueueItems: number;
  itemsNearingExpiry: number;
  averageTimeInQueueSeconds: number;
  bottleneckStage: SlaStage;
};

export type ExecutionFeedback = {
  id: string;
  queueId: string;
  orderId: string;
  mt5Ticket?: string;
  deliveredAt?: string;
  executedAt?: string;
  requestedPrice: number;
  executedPrice?: number;
  slippagePoints?: number;
  executionTimeMs?: number;
  responseCode: string;
  responseMessage: string;
  finalStatus: string;
  createdAt: string;
};

export type QueueDiagnostic = {
  id: string;
  issue: string;
  affectedQueueId?: string;
  affectedStage?: string;
  severity: "Info" | "Warning" | "Critical";
  rootCause: string;
  tradingImpact: string;
  recommendedAction: string;
  autoFixEligible: boolean;
  confidenceScore: number;
};

export type ExecutionQueueSummaryResponse = {
  meta: {
    timestamp: string;
    currentRole: Mt5Role;
    queuePaused: boolean;
    emergencyStopActive: boolean;
  };
  kpis: Array<{ label: string; value: string; status: "Healthy" | "Pending" | "Watch" | "Degraded" | "Critical"; detail: string; updatedAt: string }>;
  health: ScoreResult;
  workflow: QueueWorkflowNode[];
  permissions: {
    role: Mt5Role;
    canProcess: boolean;
    canPauseResume: boolean;
    canRetry: boolean;
    canCancel: boolean;
    canValidate: boolean;
    canReassignRoute: boolean;
    canEmergencyStop: boolean;
    canDiagnostics: boolean;
    canAutoRemediate: boolean;
  };
};

export type ExecutionQueueItemsResponse = {
  meta: { timestamp: string; total: number; page: number; pageSize: number };
  items: ExecutionQueueItem[];
};

export type ExecutionQueueItemResponse = { meta: { timestamp: string }; item: ExecutionQueueItem };

export type PrioritySlaResponse = { meta: { timestamp: string }; summary: QueueSlaPrioritySummary };
export type BottlenecksResponse = { meta: { timestamp: string }; bottlenecks: QueueBottleneck[] };
export type ExceptionsResponse = { meta: { timestamp: string; total: number }; exceptions: QueueException[] };
export type FeedbackResponse = { meta: { timestamp: string; total: number }; feedback: ExecutionFeedback[] };
export type LogsResponse = { meta: { timestamp: string; total: number }; logs: QueueLog[] };
export type DiagnosticsResponse = { meta: { timestamp: string }; diagnostics: QueueDiagnostic[] };

export type ActionResponse = {
  meta: { timestamp: string; queuePaused: boolean; emergencyStopActive: boolean };
  ok: boolean;
  message: string;
  affectedQueueIds?: string[];
};


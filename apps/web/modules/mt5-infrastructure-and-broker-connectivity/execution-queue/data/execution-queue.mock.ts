import type {
  ExecutionFeedback,
  ExecutionQueueItem,
  QueueBottleneck,
  QueueLog,
  QueuePriority,
  QueueStatus
} from "../types/execution-queue.types";

function isoNow(offsetSeconds = 0) {
  return new Date(Date.now() + offsetSeconds * 1000).toISOString();
}

function id(prefix: string, n: number) {
  return `${prefix}-${String(n).padStart(3, "0")}`;
}

function priorityByIndex(i: number): QueuePriority {
  if (i % 13 === 0) return "Critical";
  if (i % 5 === 0) return "High";
  if (i % 4 === 0) return "Low";
  return "Normal";
}

function statusByIndex(i: number): QueueStatus {
  if (i % 17 === 0) return "Blocked";
  if (i % 11 === 0) return "Failed";
  if (i % 9 === 0) return "Retried";
  if (i % 7 === 0) return "Executed";
  if (i % 6 === 0) return "Routed";
  if (i % 4 === 0) return "Processing";
  if (i % 3 === 0) return "Validated";
  return "Pending";
}

export type ExecutionQueueSeed = {
  items: ExecutionQueueItem[];
  feedback: ExecutionFeedback[];
  logs: QueueLog[];
  bottlenecks: QueueBottleneck[];
};

export function createExecutionQueueSeed(): ExecutionQueueSeed {
  const now = Date.now();
  const items: ExecutionQueueItem[] = [];
  const feedback: ExecutionFeedback[] = [];
  const logs: QueueLog[] = [];

  for (let i = 1; i <= 38; i += 1) {
    const prio = priorityByIndex(i);
    const status = statusByIndex(i);
    const createdAt = new Date(now - i * 95_000).toISOString();
    const updatedAt = new Date(now - i * 42_000).toISOString();
    const expiryTime = new Date(now + (prio === "Critical" ? 3 : prio === "High" ? 10 : prio === "Normal" ? 25 : 45) * 60_000 - i * 10_000).toISOString();
    const queueAgeSeconds = Math.max(60, Math.round((now - new Date(createdAt).getTime()) / 1000));
    const retryCount = status === "Retried" || status === "Failed" ? Math.min(3, Math.floor(i / 10)) : 0;
    const maxRetryCount = prio === "Critical" ? 1 : 3;

    const base: ExecutionQueueItem = {
      id: `qitem-${i}`,
      queueId: id("queue", i),
      orderId: id("ord", 900 + i),
      signalId: id("sig", 2200 + i),
      strategyId: i % 2 === 0 ? "strat_institutional_bias" : "strat_scalp",
      sourceEngine: i % 2 === 0 ? "AI Decision Engine" : "Risk Governance",
      priority: prio,
      account: "FTMO Challenge - Demo",
      broker: i % 4 === 0 ? "IC Markets" : "MockBroker",
      terminal: i % 3 === 0 ? "MT5-Terminal-2" : "MT5-Terminal-1",
      eaInstance: i % 3 === 0 ? "EA-Instance-B" : "EA-Instance-A",
      symbol: i % 2 === 0 ? "EURUSD" : i % 5 === 0 ? "XAUUSD" : "GBPUSD",
      normalizedSymbol: i % 2 === 0 ? "EURUSD" : i % 5 === 0 ? "XAUUSD" : "GBPUSD",
      brokerSymbol: i % 5 === 0 ? "XAUUSD" : i % 2 === 0 ? "EURUSD" : "GBPUSD",
      direction: i % 2 === 0 ? "Buy" : "Sell",
      orderType: i % 3 === 0 ? "Limit" : "Market",
      volume: i % 3 === 0 ? 0.3 : 0.2,
      entryPrice: i % 5 === 0 ? 2321.4 + i / 100 : 1.082 + i / 10_000,
      stopLoss: i % 4 === 0 ? null : i % 5 === 0 ? 2312.0 : 1.078,
      takeProfit: i % 4 === 0 ? null : i % 5 === 0 ? 2338.0 : 1.089,
      timeInForce: i % 3 === 0 ? "GTC" : "IOC",
      targetExecutionWindow: isoNow(60),
      expiryTime,
      queueStatus: status,
      validationStatus: status === "Pending" ? "Pending" : status === "Blocked" ? "Failed" : "Passed",
      riskStatus: status === "Blocked" ? "Failed" : status === "Pending" ? "Pending" : "Passed",
      accountReadinessStatus: status === "Blocked" && i % 2 === 0 ? "Not Ready" : "Ready",
      brokerReadinessStatus: status === "Blocked" && i % 2 !== 0 ? "Not Ready" : "Ready",
      terminalReadinessStatus: status === "Blocked" ? "Degraded" : "Ready",
      eaBridgeReadinessStatus: status === "Blocked" ? "Not Ready" : "Ready",
      symbolMappingStatus: status === "Blocked" && i % 7 === 0 ? "Failed" : "Passed",
      spreadValidationStatus: status === "Blocked" && i % 9 === 0 ? "Failed" : "Passed",
      marginValidationStatus: status === "Blocked" && i % 11 === 0 ? "Failed" : "Passed",
      duplicateCheckStatus: i % 19 === 0 ? "Failed" : "Passed",
      routingStatus: status === "Routed" || status === "Executed" ? "Assigned" : status === "Retried" ? "Reassigned" : "Unassigned",
      deliveryStatus: status === "Executed" ? "Delivered" : status === "Routed" ? "Pending" : status === "Failed" ? "Failed" : status === "Cancelled" ? "Cancelled" : status === "Blocked" ? "Blocked" : "Pending",
      executionStatus: status === "Executed" ? "Executed" : status === "Failed" ? "Failed" : status === "Routed" ? "Pending" : status === "Blocked" ? "Not Sent" : "Not Sent",
      retryCount,
      maxRetryCount,
      queueAgeSeconds,
      slaStatus: "Within SLA",
      failureReason:
        status === "Failed"
          ? i % 2 === 0
            ? "EA bridge unavailable"
            : "Execution feedback missing"
          : status === "Blocked"
            ? i % 3 === 0
              ? "Risk validation failed"
              : i % 5 === 0
                ? "Symbol unmapped"
                : "Broker offline"
            : undefined,
      nextAction:
        status === "Pending"
          ? "Validate"
          : status === "Validated"
            ? "Process"
            : status === "Failed"
              ? "Retry if safe"
              : status === "Blocked"
                ? "Review and remediate"
                : status === "Routed"
                  ? "Await feedback"
                  : "Monitor",
      createdAt,
      updatedAt,
      lastRetryAt: retryCount ? isoNow(-queueAgeSeconds / 3) : undefined,
      assignedRoute: status === "Routed" || status === "Executed" || status === "Retried" ? `route-${i % 4 === 0 ? "B" : "A"}-${i}` : undefined
    };

    items.push(base);

    if (status === "Executed") {
      feedback.push({
        id: `fb-${i}`,
        queueId: base.queueId,
        orderId: base.orderId,
        mt5Ticket: `45${812_000 + i}`,
        deliveredAt: isoNow(-queueAgeSeconds + 18),
        executedAt: isoNow(-queueAgeSeconds + 23),
        requestedPrice: base.entryPrice,
        executedPrice: base.entryPrice + (i % 2 === 0 ? 0.00006 : -0.00004),
        slippagePoints: i % 2 === 0 ? 0.6 : 0.4,
        executionTimeMs: 210 + i * 3,
        responseCode: "OK",
        responseMessage: "Execution confirmed",
        finalStatus: "Executed",
        createdAt: isoNow(-queueAgeSeconds + 25)
      });
    }
  }

  logs.push(
    {
      id: "qlog-001",
      queueId: "ALL",
      orderId: "ALL",
      eventType: "Queue Monitor",
      severity: "Info",
      sourceModule: "Execution Queue",
      message: "Queue heartbeat stable; monitoring pending execution items.",
      actionTaken: "Snapshot recorded",
      result: "Ok",
      createdAt: isoNow(-80)
    },
    {
      id: "qlog-002",
      queueId: "queue-011",
      orderId: "ord-911",
      eventType: "Retry",
      severity: "Warning",
      sourceModule: "Execution Queue",
      message: "Retry scheduled after EA delivery timeout.",
      actionTaken: "Retry queued",
      result: "Pending",
      createdAt: isoNow(-240)
    },
    {
      id: "qlog-003",
      queueId: "queue-017",
      orderId: "ord-917",
      eventType: "Blocked",
      severity: "Critical",
      sourceModule: "Risk Gate",
      message: "Risk validation failed; execution request blocked.",
      actionTaken: "Block enforced",
      result: "Blocked",
      createdAt: isoNow(-540)
    }
  );

  const bottlenecks: QueueBottleneck[] = [
    {
      id: "bn-001",
      bottleneckStage: "EA delivery delay",
      affectedCount: items.filter((i) => i.queueStatus === "Routed" || i.queueStatus === "Failed").length,
      averageDelaySeconds: 42,
      severity: "Warning",
      rootCause: "EA bridge command throughput below baseline.",
      recommendedAction: "Scale EA bridge workers and reassign routes to healthy terminals.",
      detectedAt: isoNow(-600)
    },
    {
      id: "bn-002",
      bottleneckStage: "Risk gate delay",
      affectedCount: items.filter((i) => i.queueStatus === "Pending" && i.riskStatus === "Pending").length,
      averageDelaySeconds: 55,
      severity: "Info",
      rootCause: "Risk engine snapshot polling cadence.",
      recommendedAction: "Enable realtime risk responses for high priority items.",
      detectedAt: isoNow(-900)
    }
  ];

  return { items, feedback, logs, bottlenecks };
}


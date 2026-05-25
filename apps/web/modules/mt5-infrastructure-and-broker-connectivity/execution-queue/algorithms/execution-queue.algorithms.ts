import type { ScoreResult } from "../../mt5-control-center/types/mt5-control-center.types";
import type { ExecutionQueueItem, QueueBottleneck, QueueDiagnostic, QueuePriority, QueueSlaPrioritySummary, QueueStatus, SlaStage } from "../types/execution-queue.types";

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function rating(score: number): ScoreResult["rating"] {
  if (score >= 90) return "Excellent";
  if (score >= 75) return "Healthy";
  if (score >= 60) return "Degraded";
  if (score >= 40) return "High Risk";
  return "Critical";
}

function priorityWeight(priority: QueuePriority) {
  if (priority === "Critical") return 4;
  if (priority === "High") return 3;
  if (priority === "Normal") return 2;
  return 1;
}

export function queueSlaThresholdSeconds(priority: QueuePriority) {
  if (priority === "Critical") return 90;
  if (priority === "High") return 240;
  if (priority === "Normal") return 600;
  return 1200;
}

export function deriveSlaStatus(item: ExecutionQueueItem) {
  const expiry = new Date(item.expiryTime).getTime();
  if (Number.isFinite(expiry) && expiry <= Date.now()) return "Expired" as const;

  const threshold = queueSlaThresholdSeconds(item.priority);
  if (item.queueAgeSeconds >= threshold) return "Breached" as const;
  if (item.queueAgeSeconds >= Math.round(threshold * 0.8)) return "Nearing Breach" as const;
  return "Within SLA" as const;
}

export function prioritizeQueue(items: ExecutionQueueItem[]) {
  const now = Date.now();
  const score = (item: ExecutionQueueItem) => {
    const expiryAt = new Date(item.expiryTime).getTime();
    const expiryUrgency = Number.isFinite(expiryAt) ? clamp(1 - Math.max(0, expiryAt - now) / (60 * 60 * 1000), 0, 1) : 0.3;
    const agePressure = clamp(item.queueAgeSeconds / queueSlaThresholdSeconds(item.priority), 0, 2);
    const riskUrgency = item.riskStatus === "Failed" ? 0 : item.riskStatus === "Pending" ? 0.5 : 1;
    const base = priorityWeight(item.priority) * 30;
    return base + expiryUrgency * 25 + agePressure * 20 + riskUrgency * 15 - item.retryCount * 10;
  };

  return [...items].sort((a, b) => score(b) - score(a));
}

export function calculateQueueHealthScore(items: ExecutionQueueItem[]) {
  const total = Math.max(1, items.length);
  const count = (predicate: (i: ExecutionQueueItem) => boolean) => items.filter(predicate).length;

  const executed = count((i) => i.queueStatus === "Executed");
  const failed = count((i) => i.queueStatus === "Failed");
  const blocked = count((i) => i.queueStatus === "Blocked");
  const pending = count((i) => i.queueStatus === "Pending");
  const breached = count((i) => i.slaStatus === "Breached" || i.slaStatus === "Expired");
  const retried = count((i) => i.queueStatus === "Retried");

  const throughputScore = clamp((executed / total) * 25, 0, 25);
  const validationScore = clamp((count((i) => i.validationStatus === "Passed") / total) * 15, 0, 15);
  const riskGateScore = clamp((count((i) => i.riskStatus === "Passed") / total) * 15, 0, 15);
  const routingScore = clamp((count((i) => i.routingStatus === "Assigned" || i.routingStatus === "Reassigned") / total) * 15, 0, 15);
  const executionScore = clamp((executed / total) * 20, 0, 20);
  const feedbackScore = clamp((count((i) => i.executionStatus === "Executed") / total) * 10, 0, 10);

  const backlogPenalty = clamp((pending / total) * 15, 0, 15);
  const retryPenalty = clamp((retried / total) * 10, 0, 10);
  const slaPenalty = clamp((breached / total) * 20, 0, 20);

  const raw =
    throughputScore + validationScore + riskGateScore + routingScore + executionScore + feedbackScore - backlogPenalty - retryPenalty - slaPenalty - (failed / total) * 10 - (blocked / total) * 10;

  const score = clamp(Math.round(raw), 0, 100);
  const factors = {
    throughputScore,
    validationScore,
    riskGateScore,
    routingScore,
    executionScore,
    feedbackScore,
    backlogPenalty,
    retryPenalty,
    slaPenalty,
    failedItems: failed,
    blockedItems: blocked
  };

  return { score, rating: rating(score), factors } satisfies ScoreResult;
}

export function detectBottlenecks(items: ExecutionQueueItem[]): QueueBottleneck[] {
  const stages: Array<{ stage: SlaStage; predicate: (i: ExecutionQueueItem) => boolean; rootCause: string; action: string }> = [
    { stage: "Validation delay", predicate: (i) => i.queueStatus === "Pending", rootCause: "Validation backlog in queue.", action: "Process and force validate high priority items first." },
    { stage: "Risk gate delay", predicate: (i) => i.validationStatus === "Passed" && i.riskStatus === "Pending", rootCause: "Risk gate queue congestion.", action: "Enable realtime risk approvals for critical queue items." },
    { stage: "Broker readiness delay", predicate: (i) => i.brokerReadinessStatus !== "Ready", rootCause: "Broker readiness degraded/offline.", action: "Reassign routes to healthy brokers and validate sessions." },
    { stage: "Account readiness delay", predicate: (i) => i.accountReadinessStatus !== "Ready", rootCause: "Account not ready or trading disabled.", action: "Run account sync and verify trading enabled flag." },
    { stage: "Terminal delay", predicate: (i) => i.terminalReadinessStatus !== "Ready", rootCause: "Terminal offline or latency spike.", action: "Restart terminal or switch to standby terminal." },
    { stage: "EA delivery delay", predicate: (i) => i.queueStatus === "Routed" && i.deliveryStatus === "Pending", rootCause: "EA bridge delivery not confirmed.", action: "Check EA bridge health and message bus backlog." },
    { stage: "Execution feedback delay", predicate: (i) => i.deliveryStatus === "Delivered" && i.executionStatus === "Pending", rootCause: "MT5 feedback delay.", action: "Inspect MT5 journal and ensure feedback listener is active." },
    { stage: "Retry congestion", predicate: (i) => i.queueStatus === "Retried", rootCause: "Repeated retries congesting pipeline.", action: "Throttle retries and prioritize critical risk-reduction actions." },
    { stage: "Blocked queue buildup", predicate: (i) => i.queueStatus === "Blocked", rootCause: "Items blocked by safety gates.", action: "Review block reasons and remediate dependencies." }
  ];

  const now = new Date().toISOString();
  const total = Math.max(1, items.length);

  return stages
    .map((s, idx) => {
      const affected = items.filter(s.predicate);
      if (!affected.length) return null;
      const avgDelay = Math.round(affected.reduce((sum, it) => sum + it.queueAgeSeconds, 0) / affected.length);
      const ratio = affected.length / total;
      const severity: QueueBottleneck["severity"] = ratio >= 0.22 ? "Critical" : ratio >= 0.12 ? "Warning" : "Info";
      return {
        id: `bn-auto-${idx + 1}`,
        bottleneckStage: s.stage,
        affectedCount: affected.length,
        averageDelaySeconds: avgDelay,
        severity,
        rootCause: s.rootCause,
        recommendedAction: s.action,
        detectedAt: now
      } satisfies QueueBottleneck;
    })
    .filter(Boolean) as QueueBottleneck[];
}

export function computePrioritySlaSummary(items: ExecutionQueueItem[], bottlenecks: QueueBottleneck[]): QueueSlaPrioritySummary {
  const total = Math.max(1, items.length);
  const avg = Math.round(items.reduce((sum, it) => sum + it.queueAgeSeconds, 0) / total);
  const expired = items.filter((it) => it.slaStatus === "Expired").length;
  const breached = items.filter((it) => it.slaStatus === "Breached").length;
  const nearingExpiry = items.filter((it) => {
    const expiryAt = new Date(it.expiryTime).getTime();
    if (!Number.isFinite(expiryAt)) return false;
    const minutes = (expiryAt - Date.now()) / 60_000;
    return minutes > 0 && minutes <= 10;
  }).length;

  const topBottleneck = bottlenecks.sort((a, b) => b.affectedCount - a.affectedCount)[0]?.bottleneckStage ?? "Validation delay";

  return {
    criticalPriorityQueue: items.filter((it) => it.priority === "Critical").length,
    highPriorityQueue: items.filter((it) => it.priority === "High").length,
    normalPriorityQueue: items.filter((it) => it.priority === "Normal").length,
    lowPriorityQueue: items.filter((it) => it.priority === "Low").length,
    expiredQueueItems: expired,
    slaBreachedQueueItems: breached,
    itemsNearingExpiry: nearingExpiry,
    averageTimeInQueueSeconds: avg,
    bottleneckStage: topBottleneck
  };
}

export function generateQueueDiagnostics(items: ExecutionQueueItem[], bottlenecks: QueueBottleneck[]): QueueDiagnostic[] {
  const diagnostics: QueueDiagnostic[] = [];

  const backlog = items.filter((i) => i.queueStatus === "Pending" || i.queueStatus === "Validated").length;
  if (backlog >= 12) {
    diagnostics.push({
      id: "diag-backlog",
      issue: "Queue backlog",
      affectedStage: "Queue Created",
      severity: backlog >= 20 ? "Critical" : "Warning",
      rootCause: "Pending and validated items exceed baseline processing throughput.",
      tradingImpact: "New entries may miss execution windows and risk reduction actions may delay.",
      recommendedAction: "Process queue and prioritize critical/high items; verify EA bridge and terminal readiness.",
      autoFixEligible: true,
      confidenceScore: backlog >= 20 ? 86 : 74
    });
  }

  const stuck = items.find((i) => i.queueAgeSeconds >= queueSlaThresholdSeconds(i.priority) && (i.queueStatus === "Pending" || i.queueStatus === "Routed"));
  if (stuck) {
    diagnostics.push({
      id: `diag-stuck-${stuck.queueId}`,
      issue: "Queue item stuck",
      affectedQueueId: stuck.queueId,
      affectedStage: stuck.queueStatus,
      severity: stuck.priority === "Critical" ? "Critical" : "Warning",
      rootCause: stuck.failureReason ?? "Execution pipeline delay beyond SLA threshold.",
      tradingImpact: "Execution may be unsafe, expired, or duplicated if retried improperly.",
      recommendedAction: "Re-run validation and risk gate; reassign route if dependencies degraded; cancel if expired.",
      autoFixEligible: stuck.priority !== "Critical",
      confidenceScore: 82
    });
  }

  const repeatRetry = items.find((i) => i.retryCount >= Math.max(2, i.maxRetryCount - 1) && (i.queueStatus === "Failed" || i.queueStatus === "Retried"));
  if (repeatRetry) {
    diagnostics.push({
      id: `diag-retry-${repeatRetry.queueId}`,
      issue: "Repeated retry failure",
      affectedQueueId: repeatRetry.queueId,
      affectedStage: "Retry congestion",
      severity: "Critical",
      rootCause: repeatRetry.failureReason ?? "Retry safety rules reached threshold.",
      tradingImpact: "Retry loop can cause duplicate execution risk and degrade queue throughput.",
      recommendedAction: "Block unsafe retries, investigate root cause, and reassign route or cancel if execution window expired.",
      autoFixEligible: false,
      confidenceScore: 88
    });
  }

  for (const bn of bottlenecks.slice(0, 4)) {
    diagnostics.push({
      id: `diag-bn-${bn.id}`,
      issue: "Bottleneck detected",
      affectedStage: bn.bottleneckStage,
      severity: bn.severity === "Critical" ? "Critical" : bn.severity === "Warning" ? "Warning" : "Info",
      rootCause: bn.rootCause,
      tradingImpact: "Queue throughput and SLA adherence degrade while stage is congested.",
      recommendedAction: bn.recommendedAction,
      autoFixEligible: bn.severity !== "Critical",
      confidenceScore: bn.severity === "Critical" ? 84 : 72
    });
  }

  const missingFeedback = items.filter((i) => i.queueStatus === "Routed" && i.deliveryStatus === "Pending").slice(0, 3);
  for (const item of missingFeedback) {
    diagnostics.push({
      id: `diag-feedback-${item.queueId}`,
      issue: "Missing execution feedback",
      affectedQueueId: item.queueId,
      affectedStage: "Feedback Received",
      severity: "Warning",
      rootCause: "EA delivery pending or MT5 feedback listener delayed.",
      tradingImpact: "State uncertainty increases duplicate retry risk.",
      recommendedAction: "Verify delivery confirmation, then retry only if safe and feedback confirms non-execution.",
      autoFixEligible: true,
      confidenceScore: 68
    });
  }

  return diagnostics.slice(0, 18);
}

export function safeRetryDecision(item: ExecutionQueueItem, context: { emergencyStopActive: boolean; queuePaused: boolean; duplicateClear: boolean; priceWithinTolerance: boolean; dependenciesHealthy: boolean }) {
  const failures: string[] = [];
  if (context.emergencyStopActive) failures.push("Emergency stop active");
  if (context.queuePaused) failures.push("Queue is paused");
  if (item.retryCount >= item.maxRetryCount) failures.push("Retry count exceeds safe limit");
  if (!context.duplicateClear) failures.push("Duplicate order risk not cleared");
  if (!context.priceWithinTolerance) failures.push("Market price out of tolerance");
  if (item.riskStatus !== "Passed") failures.push("Risk engine not approved");
  if (!context.dependenciesHealthy) failures.push("Broker/account/terminal/EA bridge not healthy");
  if (item.slaStatus === "Expired") failures.push("Execution request expired");

  return { safe: failures.length === 0, failures };
}


import type {
  AiExecutionDiagnostic,
  BrokerResponseRecord,
  ExecutionException,
  ExecutionLifecycleNode,
  ExecutionLog,
  ExecutionOrderType,
  ExecutionStatus,
  ExecutionQualityMetric,
  RiskLevel,
  RetryCancellationRecord
} from "../types/execution-logs.types";

export function classifyExecutionOutcome(input: Pick<ExecutionLog, "executionStatus" | "mt5Ticket" | "fillStatus" | "executionTimeMs" | "brokerResponseCode">) {
  if (input.executionStatus === "Executed" || input.executionStatus === "Partially Filled") return input.executionStatus;
  if (input.executionStatus === "Rejected") return "Rejected";
  if (input.executionStatus === "Requoted") return "Requoted";
  if (input.executionStatus === "Cancelled") return "Cancelled";
  if (input.executionStatus === "Timed Out") return "Timed Out";
  if (input.executionStatus === "Failed") return "Failed";
  if (input.executionStatus === "Missing Feedback") return "Missing Feedback";
  if (input.executionStatus === "Synced") return "Synced";
  if (!input.mt5Ticket && (input.executionStatus === "Delivered" || input.executionStatus === "Sent")) return "Pending";
  return input.executionStatus;
}

export function classifyBrokerResponse(record: Pick<BrokerResponseRecord, "responseCode" | "responseMessage">) {
  const code = String(record.responseCode ?? "").toUpperCase();
  const msg = String(record.responseMessage ?? "").toLowerCase();
  const detect = (pattern: RegExp) => pattern.test(msg) || pattern.test(code);

  const insufficientMargin = detect(/insufficient margin|not enough money|margin/i);
  const invalidStops = detect(/invalid stops|invalid stop|stops/i);
  const invalidVolume = detect(/invalid volume|volume too|lot/i);
  const marketClosed = detect(/market closed|trade disabled|trading disabled/i);
  const offQuotes = detect(/off quotes|offquote|requote|price changed/i);
  const requote = detect(/requote|price changed/i) || code === "REQUOTE";
  const tradeContextBusy = detect(/trade context busy|context busy/i);
  const brokerTimeout = detect(/timeout|timed out/i);
  const symbolDisabled = detect(/symbol disabled|unknown symbol|symbol/i) && detect(/disabled|unknown/i);
  const accountDisabled = detect(/account disabled|disabled account|no connection/i);

  const rejectionReason =
    insufficientMargin ? "Insufficient margin" :
    invalidStops ? "Invalid stops" :
    invalidVolume ? "Invalid volume" :
    marketClosed ? "Market closed / trading disabled" :
    tradeContextBusy ? "Trade context busy" :
    offQuotes ? "Off quotes / requote / price moved" :
    brokerTimeout ? "Broker timeout" :
    symbolDisabled ? "Symbol disabled / unknown" :
    accountDisabled ? "Account disabled / disconnected" :
    null;

  const flags = {
    insufficientMargin,
    invalidStops,
    invalidVolume,
    marketClosed,
    offQuotes,
    requote,
    tradeContextBusy,
    brokerTimeout,
    symbolDisabled,
    accountDisabled
  };

  const requiredFix =
    insufficientMargin ? "Reduce volume or free margin; revalidate risk and leverage." :
    invalidStops ? "Recompute stops vs broker stop-level; adjust SL/TP and retry safely." :
    invalidVolume ? "Adjust volume to broker min/step; normalize to symbol volume rules." :
    marketClosed ? "Defer until session opens or route to alternative broker/symbol." :
    tradeContextBusy ? "Backoff and retry after terminal is idle; reduce parallel sends." :
    offQuotes ? "Refresh quote, widen tolerance, and retry if risk still valid." :
    brokerTimeout ? "Check connectivity/latency; retry with exponential backoff if safe." :
    symbolDisabled ? "Fix symbol mapping; ensure symbol enabled and market watch subscribed." :
    accountDisabled ? "Re-authenticate account; verify permissions and login health." :
    "Investigate broker response; correlate with terminal/bridge/router health.";

  const severity =
    brokerTimeout || accountDisabled ? ("Critical" as const) :
    insufficientMargin || invalidVolume || invalidStops ? ("Warning" as const) :
    offQuotes || requote || tradeContextBusy ? ("Warning" as const) :
    ("Info" as const);

  const aiExplanation =
    rejectionReason ? `Broker rejected with reason: ${rejectionReason}. ${requiredFix}` : `Broker response classified as informational. ${requiredFix}`;

  return { rejectionReason, flags, requiredFix, severity, aiExplanation };
}

export function unsafeRetryDecision(input: {
  mt5TicketExists: boolean;
  executionStatus: ExecutionStatus;
  feedbackMissing: boolean;
  marketMovedBeyondTolerance: boolean;
  riskExpired: boolean;
  duplicateOrderRisk: boolean;
  retryCount: number;
  maxRetryCount: number;
}) {
  const reasons: string[] = [];
  if (input.mt5TicketExists) reasons.push("ticket-exists");
  if (input.executionStatus === "Unknown" as any) reasons.push("unknown-status");
  if (input.feedbackMissing) reasons.push("feedback-missing");
  if (input.marketMovedBeyondTolerance) reasons.push("market-moved");
  if (input.riskExpired) reasons.push("risk-expired");
  if (input.duplicateOrderRisk) reasons.push("duplicate-risk");
  if (input.retryCount >= input.maxRetryCount) reasons.push("retry-exceeded");

  const safe = reasons.length === 0;
  return { safe, reasons, recommendation: safe ? "Retry allowed with backoff and evidence capture." : "Block retry; escalate or cancel to prevent duplicate/unsafe execution." };
}

export function executionQualityScore(input: {
  successRate: number;
  averageExecutionTimeMs: number;
  averageSlippagePoints: number;
  rejectionRate: number;
  requoteRate: number;
  feedbackCompletenessRate: number;
  retryRate: number;
  timeoutRate: number;
}) {
  const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
  const successRateScore = clamp01(input.successRate) * 35;
  const speedScore = (1 - clamp01(input.averageExecutionTimeMs / 2500)) * 15;
  const slippageScore = (1 - clamp01(Math.abs(input.averageSlippagePoints) / 30)) * 15;
  const rejectionScore = (1 - clamp01(input.rejectionRate)) * 10;
  const requoteScore = (1 - clamp01(input.requoteRate)) * 8;
  const feedbackCompletenessScore = clamp01(input.feedbackCompletenessRate) * 12;
  const retryPenalty = clamp01(input.retryRate) * 8;
  const timeoutPenalty = clamp01(input.timeoutRate) * 12;

  const score = Math.round(successRateScore + speedScore + slippageScore + rejectionScore + requoteScore + feedbackCompletenessScore - retryPenalty - timeoutPenalty);
  const rating =
    score >= 90 ? ("Excellent" as const) :
    score >= 75 ? ("Healthy" as const) :
    score >= 60 ? ("Degraded" as const) :
    score >= 40 ? ("High Risk" as const) :
    ("Critical" as const);
  return {
    score: Math.max(0, Math.min(100, score)),
    rating,
    factors: {
      successRateScore: Math.round(successRateScore),
      speedScore: Math.round(speedScore),
      slippageScore: Math.round(slippageScore),
      rejectionScore: Math.round(rejectionScore),
      requoteScore: Math.round(requoteScore),
      feedbackCompletenessScore: Math.round(feedbackCompletenessScore),
      retryPenalty: Math.round(retryPenalty),
      timeoutPenalty: Math.round(timeoutPenalty)
    }
  };
}

export function riskFromLog(log: Pick<ExecutionLog, "riskLevel" | "executionStatus" | "retryCount" | "slippagePoints" | "executionTimeMs">): RiskLevel {
  const base =
    log.riskLevel === "Critical" ? 5 :
    log.riskLevel === "High" ? 4 :
    log.riskLevel === "Elevated" ? 3 :
    log.riskLevel === "Moderate" ? 2 :
    1;

  const statusBoost = log.executionStatus === "Failed" || log.executionStatus === "Timed Out" ? 1.2 : log.executionStatus === "Rejected" ? 1.1 : 1;
  const retryBoost = log.retryCount >= 3 ? 1.2 : log.retryCount >= 1 ? 1.1 : 1;
  const slipBoost = log.slippagePoints != null && Math.abs(log.slippagePoints) >= 25 ? 1.2 : log.slippagePoints != null && Math.abs(log.slippagePoints) >= 12 ? 1.1 : 1;
  const timeBoost = log.executionTimeMs != null && log.executionTimeMs >= 2500 ? 1.2 : log.executionTimeMs != null && log.executionTimeMs >= 1500 ? 1.1 : 1;

  const s = base * statusBoost * retryBoost * slipBoost * timeBoost;
  if (s >= 5) return "Critical";
  if (s >= 4) return "High";
  if (s >= 3) return "Elevated";
  if (s >= 2) return "Moderate";
  return "Low";
}

export function buildWorkflow(logs: ExecutionLog[], latestDiagnostic: AiExecutionDiagnostic | null): ExecutionLifecycleNode[] {
  const now = new Date().toISOString();
  const latestFailure = logs.find((l) => l.executionStatus === "Failed" || l.executionStatus === "Rejected" || l.executionStatus === "Timed Out");
  const latestFailureText = latestFailure ? `${latestFailure.executionId}: ${latestFailure.brokerResponseMessage ?? latestFailure.executionStatus}` : "None";
  const total = logs.length;
  const failures = logs.filter((l) => l.executionStatus === "Failed" || l.executionStatus === "Timed Out").length;
  const avg = total ? Math.round(logs.reduce((sum, l) => sum + (l.executionTimeMs ?? 800), 0) / total) : 0;
  const ai = latestDiagnostic?.recommendedFix ?? "Investigate broker response codes, verify ticket creation, and block unsafe retries.";

  const step = (title: ExecutionLifecycleNode["title"], status: ExecutionLifecycleNode["status"], eventCount: number, failedCount: number, avgDuration: number, rec: string): ExecutionLifecycleNode => ({
    title,
    status,
    eventCount,
    failedCount,
    averageDurationMs: avgDuration,
    latestFailure: latestFailureText,
    aiRecommendation: rec
  });

  const safeRatio = total ? 1 - failures / total : 1;
  const overallStatus: ExecutionLifecycleNode["status"] = safeRatio >= 0.9 ? "Healthy" : safeRatio >= 0.8 ? "Watch" : safeRatio >= 0.65 ? "Degraded" : "Critical";

  return [
    step("Signal Approved", "Healthy", total, 0, 80, "Validate signal integrity and strategy constraints before enqueue."),
    step("Order Queued", overallStatus, total, failures, 120, "Monitor queue backpressure and route capacity."),
    step("Risk Passed", overallStatus, total, failures, 160, "Ensure risk gate freshness; expire stale approvals."),
    step("Route Assigned", overallStatus, total, failures, 190, "Verify broker/terminal availability and fallback routes."),
    step("EA Command Sent", overallStatus, total, failures, 260, "Detect delivery failures and enforce deduplication."),
    step("Broker Response Received", overallStatus, total, failures, 320, ai),
    step("MT5 Ticket Created", failures ? "Watch" : "Healthy", total, logs.filter((l) => !l.mt5Ticket).length, 420, "Ticket missing indicates bridge/terminal issues; correlate with heartbeat."),
    step("Fill Confirmed", overallStatus, total, logs.filter((l) => l.fillStatus === "Not Filled").length, avg, "Confirm fill completeness; detect partial fill patterns."),
    step("Trade Synced", overallStatus, total, logs.filter((l) => l.executionStatus !== "Synced" && l.executionStatus !== "Executed").length, avg + 120, "Reconcile trade state; validate ticket->trade linkage."),
    step("Audit Completed", "Healthy", total, 0, 60, "Audit review/escalation/remediation/export actions with immutable records.")
  ];
}

export function failureClustering(logs: ExecutionLog[]) {
  const failures = logs.filter((l) => l.executionStatus === "Failed" || l.executionStatus === "Rejected" || l.executionStatus === "Timed Out" || l.executionStatus === "Missing Feedback");
  const keyOf = (l: ExecutionLog) => [l.brokerId, l.accountId, l.normalizedSymbol, l.strategyId, l.eaInstanceId ?? "none", l.terminalId, l.brokerResponseCode ?? "none"].join("|");
  const by = new Map<string, { count: number; example: ExecutionLog }>();
  for (const f of failures) {
    const k = keyOf(f);
    const prev = by.get(k);
    if (!prev) by.set(k, { count: 1, example: f });
    else by.set(k, { count: prev.count + 1, example: prev.example });
  }
  return [...by.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 12)
    .map(([clusterKey, v]) => ({
      clusterKey,
      count: v.count,
      broker: v.example.broker,
      account: v.example.account,
      symbol: v.example.normalizedSymbol,
      strategyId: v.example.strategyId,
      terminal: v.example.terminal,
      responseCode: v.example.brokerResponseCode ?? "—",
      sampleExecutionId: v.example.executionId
    }));
}

export function toQualityMetrics(logs: ExecutionLog[], brokerResponses: BrokerResponseRecord[]): ExecutionQualityMetric[] {
  const by = new Map<string, { brokerId: string; broker: string; accountId: string; account: string; strategyId: string; strategy: string; symbol: string; rows: ExecutionLog[]; responses: BrokerResponseRecord[] }>();
  for (const l of logs) {
    const key = [l.brokerId, l.accountId, l.strategyId, l.normalizedSymbol].join("|");
    const prev = by.get(key);
    if (!prev) by.set(key, { brokerId: l.brokerId, broker: l.broker, accountId: l.accountId, account: l.account, strategyId: l.strategyId, strategy: `Strategy-${l.strategyId}`, symbol: l.normalizedSymbol, rows: [l], responses: [] });
    else prev.rows.push(l);
  }
  for (const r of brokerResponses) {
    const matching = logs.find((l) => l.id === r.executionLogId);
    if (!matching) continue;
    const key = [matching.brokerId, matching.accountId, matching.strategyId, matching.normalizedSymbol].join("|");
    const prev = by.get(key);
    if (prev) prev.responses.push(r);
  }

  const metrics: ExecutionQualityMetric[] = [];
  let n = 1;
  for (const group of by.values()) {
    const total = group.rows.length;
    const successful = group.rows.filter((l) => l.executionStatus === "Executed" || l.executionStatus === "Synced").length;
    const failed = group.rows.filter((l) => l.executionStatus === "Failed" || l.executionStatus === "Timed Out").length;
    const rejected = group.rows.filter((l) => l.executionStatus === "Rejected").length;
    const requotes = group.rows.filter((l) => l.executionStatus === "Requoted").length;
    const retries = group.rows.reduce((sum, l) => sum + l.retryCount, 0);
    const avgTime = Math.round(group.rows.reduce((sum, l) => sum + (l.executionTimeMs ?? 0), 0) / Math.max(1, total));
    const avgSlip = Math.round(group.rows.reduce((sum, l) => sum + (l.slippagePoints ?? 0), 0) / Math.max(1, total));
    const successRate = total ? successful / total : 0;
    const failureRate = total ? (failed + rejected) / total : 0;
    const q = executionQualityScore({
      successRate,
      averageExecutionTimeMs: avgTime,
      averageSlippagePoints: avgSlip,
      rejectionRate: total ? rejected / total : 0,
      requoteRate: total ? requotes / total : 0,
      feedbackCompletenessRate: total ? group.rows.filter((l) => l.executionStatus !== "Missing Feedback").length / total : 1,
      retryRate: total ? Math.min(1, retries / total / 3) : 0,
      timeoutRate: total ? group.rows.filter((l) => l.executionStatus === "Timed Out").length / total : 0
    });

    metrics.push({
      id: `qm-${String(n).padStart(3, "0")}`,
      brokerId: group.brokerId,
      broker: group.broker,
      accountId: group.accountId,
      account: group.account,
      strategyId: group.strategyId,
      strategy: group.strategy,
      symbol: group.symbol,
      totalExecutions: total,
      successfulExecutions: successful,
      failedExecutions: failed,
      rejectedExecutions: rejected,
      requoteCount: requotes,
      retryCount: retries,
      averageExecutionTimeMs: avgTime,
      averageSlippagePoints: avgSlip,
      successRate,
      failureRate,
      executionQualityScore: q.score,
      measuredAt: new Date().toISOString()
    });
    n += 1;
  }
  return metrics.sort((a, b) => b.executionQualityScore - a.executionQualityScore);
}

export function buildExceptions(logs: ExecutionLog[], brokerResponses: BrokerResponseRecord[]): ExecutionException[] {
  const exceptions: ExecutionException[] = [];
  let n = 1;
  for (const l of logs) {
    const isFailure = l.executionStatus === "Failed" || l.executionStatus === "Timed Out" || l.executionStatus === "Missing Feedback" || l.executionStatus === "Rejected" || l.executionStatus === "Requoted" || l.executionStatus === "Cancelled";
    if (!isFailure) continue;
    const resp = brokerResponses.find((r) => r.executionLogId === l.id);
    const classified = resp ? classifyBrokerResponse(resp) : null;
    const type =
      l.executionStatus === "Rejected" ? "Rejected" :
      l.executionStatus === "Requoted" ? "Requoted" :
      l.executionStatus === "Cancelled" ? "Cancelled" :
      l.executionStatus === "Missing Feedback" ? "Missing Feedback" :
      l.executionStatus === "Timed Out" ? "Timeout" :
      "Failed";

    exceptions.push({
      id: `ex-${String(n).padStart(3, "0")}`,
      occurredAt: l.occurredAt,
      executionLogId: l.logId,
      executionId: l.executionId,
      orderId: l.orderId,
      brokerId: l.brokerId,
      broker: l.broker,
      accountId: l.accountId,
      account: l.account,
      symbol: l.normalizedSymbol,
      exceptionType: type as any,
      severity: classified?.severity ?? (type === "Timeout" || type === "Failed" ? "Critical" : "Warning"),
      rootCause: classified?.rejectionReason ?? (type === "Missing Feedback" ? "Feedback missing from EA/terminal." : "Execution failure."),
      tradingImpact: type === "Rejected" ? "Order not executed; strategy intent unmet." : type === "Requoted" ? "Price moved; execution quality degraded." : "Execution path degraded; potential missed fills.",
      resolutionStatus: "Unresolved",
      assignedTo: null,
      aiExplanation: classified?.aiExplanation ?? "Correlate with broker/terminal/bridge health and validate ticket creation.",
      resolvedAt: null,
      createdAt: new Date().toISOString()
    });
    n += 1;
  }
  return exceptions.slice(0, 120);
}

export function buildDiagnostics(logs: ExecutionLog[], brokerResponses: BrokerResponseRecord[], retries: RetryCancellationRecord[]): AiExecutionDiagnostic[] {
  const failures = logs.filter((l) => l.executionStatus === "Failed" || l.executionStatus === "Rejected" || l.executionStatus === "Timed Out" || l.executionStatus === "Missing Feedback").slice(0, 40);
  const diagnostics: AiExecutionDiagnostic[] = [];
  for (const l of failures) {
    const resp = brokerResponses.find((r) => r.executionLogId === l.id);
    const classified = resp ? classifyBrokerResponse(resp) : null;
    const retry = retries.find((r) => r.originalExecutionId === l.executionId) ?? null;
    const retryRisk = retry?.safeRetryStatus === "Unsafe";

    const issueSummary =
      l.executionStatus === "Rejected" ? `Rejected: ${classified?.rejectionReason ?? "Broker rejection"}` :
      l.executionStatus === "Timed Out" ? "Execution timeout: missing broker/terminal feedback" :
      l.executionStatus === "Missing Feedback" ? "Missing MT5 feedback / ticket confirmation" :
      "Execution failure cluster detected";

    const severity =
      l.riskLevel === "Critical" || l.executionStatus === "Timed Out" ? ("Critical" as const) :
      l.executionStatus === "Rejected" || l.executionStatus === "Missing Feedback" ? ("Warning" as const) :
      ("Info" as const);

    const likelyRootCause =
      classified?.rejectionReason ??
      (l.executionStatus === "Timed Out" ? "Broker/terminal latency or bridge disconnect." : l.executionStatus === "Missing Feedback" ? "EA/terminal delivery missing; heartbeat instability likely." : "Router/queue failure or infra degradation.");

    const tradingImpact =
      l.executionStatus === "Rejected" ? "Order not executed; opportunity missed; potential strategy drift." :
      l.executionStatus === "Timed Out" ? "Uncertain execution state; duplicate risk; trading path unsafe." :
      "Execution quality degraded; higher slippage/requotes likely.";

    const recommendedFix =
      classified?.requiredFix ??
      (l.executionStatus === "Timed Out" ? "Check latency/bridge health; block retries until feedback is confirmed." : "Run diagnostics; validate route and ticket creation pipeline.");

    const fallbackRecommendation =
      l.brokerId === "broker-icm" ? "Failover to Pepperstone route if risk gate allows." :
      l.brokerId === "broker-pep" ? "Failover to IC Markets route if safe." :
      "Route to healthiest broker/terminal pair and reduce volume until stable.";

    const confidenceScore = Math.max(0.35, Math.min(0.95, 0.55 + (l.executionStatus === "Rejected" ? 0.2 : 0.1) + (classified?.rejectionReason ? 0.15 : 0)));
    const autoRemediationEligible = l.executionStatus === "Requoted" || l.executionStatus === "Rejected" || l.executionStatus === "Failed";
    const escalationRequired = l.riskLevel === "Critical" || l.executionStatus === "Timed Out" || retryRisk;

    diagnostics.push({
      id: `aid-${l.logId}`,
      executionLogId: l.logId,
      executionId: l.executionId,
      orderId: l.orderId,
      issueSummary,
      severity,
      likelyRootCause,
      tradingImpact,
      recommendedFix,
      fallbackRecommendation,
      confidenceScore,
      autoRemediationEligible,
      autoRemediationStatus: "Not Started",
      escalationRequired,
      createdAt: new Date().toISOString(),
      resolvedAt: null
    });
  }
  return diagnostics;
}

export function toCsv(logs: ExecutionLog[]) {
  if (!logs.length) return "";
  const headers = [
    "logId",
    "occurredAt",
    "executionId",
    "orderId",
    "signalId",
    "strategyId",
    "account",
    "broker",
    "terminal",
    "eaInstance",
    "symbol",
    "direction",
    "orderType",
    "volume",
    "requestedPrice",
    "executedPrice",
    "mt5Ticket",
    "executionStatus",
    "brokerResponseCode",
    "brokerResponseMessage",
    "slippagePoints",
    "executionTimeMs",
    "retryCount",
    "riskLevel",
    "reviewedStatus"
  ];
  const escape = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return [headers.join(","), ...logs.map((l) => headers.map((h) => escape((l as any)[h])).join(","))].join("\n");
}

export function normalizeSymbol(symbol: string) {
  return symbol.replace(/[^A-Z]/g, "");
}

export function stopDistance(symbol: string, requested: number, stop: number | null) {
  if (stop == null) return null;
  const digits = symbol.includes("JPY") ? 3 : 5;
  const pip = digits === 3 ? 0.01 : 0.0001;
  return Math.round(Math.abs(requested - stop) / pip);
}

export function orderTypeHint(orderType: ExecutionOrderType, tif: ExecutionLog["timeInForce"]) {
  if (orderType === "Market") return "Immediate market execution";
  if (tif === "IOC") return "Immediate-or-cancel; may reject on partial liquidity";
  if (tif === "FOK") return "Fill-or-kill; rejects if full fill not available";
  return "Pending order execution based on price trigger";
}

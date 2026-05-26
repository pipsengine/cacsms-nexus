import type {
  Mt5ErrorAiDiagnostic,
  Mt5ErrorCategory,
  Mt5ErrorFingerprint,
  Mt5ErrorIncident,
  Mt5ErrorLog,
  Mt5ErrorResolutionStatus,
  Mt5ErrorRiskLevel,
  Mt5ErrorSeverity,
  Mt5ErrorSourceModule,
  Mt5ErrorTrendPoint,
  Mt5ErrorType,
  Mt5ErrorWorkflowNode
} from "../types/mt5-error-logs.types";

export function normalizeMessage(input: string) {
  return input
    .toLowerCase()
    .replace(/\b0x[0-9a-f]+\b/g, "<hex>")
    .replace(/\b\d+(\.\d+)?(?=[a-z%])/g, "<n>")
    .replace(/\b\d+(\.\d+)?\b/g, "<n>")
    .replace(/[a-f0-9]{16,}/g, "<hash>")
    .replace(/\s+/g, " ")
    .trim();
}

export function fnv1aHashHex(input: string) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function stackSignature(stackTrace: string | null | undefined) {
  if (!stackTrace) return "";
  const lines = stackTrace.split("\n").map((l) => l.trim()).filter(Boolean);
  return lines.slice(0, 6).join("|").replace(/\b\d+:\d+\b/g, "<ln>");
}

export function affectedComponent(log: Pick<Mt5ErrorLog, "brokerId" | "accountId" | "terminalId" | "eaInstanceId" | "orderId" | "symbol" | "sourceModule">) {
  if (log.terminalId) return { type: "Terminal", id: log.terminalId };
  if (log.eaInstanceId) return { type: "EA Instance", id: log.eaInstanceId };
  if (log.accountId) return { type: "Account", id: log.accountId };
  if (log.brokerId) return { type: "Broker", id: log.brokerId };
  if (log.orderId) return { type: "Order", id: log.orderId };
  if (log.symbol) return { type: "Symbol", id: log.symbol };
  if (log.sourceModule && log.sourceModule !== "Unknown") return { type: "Service", id: log.sourceModule };
  return { type: "Unknown", id: null };
}

export function fingerprintFor(log: Pick<Mt5ErrorLog, "sourceModule" | "errorType" | "errorCode" | "errorMessage" | "stackTrace" | "payloadHash" | "brokerId" | "accountId" | "terminalId" | "eaInstanceId" | "orderId" | "symbol">) {
  const normalized = normalizeMessage(log.errorMessage);
  const stack = stackSignature(log.stackTrace);
  const comp = affectedComponent({ ...log, sourceModule: log.sourceModule }).type;
  const base = [
    log.sourceModule,
    log.errorType,
    log.errorCode ?? "",
    normalized,
    comp,
    stack,
    log.payloadHash ?? ""
  ].join("|");
  return fnv1aHashHex(base);
}

export type ErrorSeverityScoreBreakdown = {
  tradingImpactScore: number;
  affectedComponentScore: number;
  repeatFrequencyScore: number;
  dependencyImpactScore: number;
  unresolvedDurationScore: number;
};

export function errorSeverityScore(input: {
  sourceModule: Mt5ErrorSourceModule;
  errorType: Mt5ErrorType;
  repeatCount: number;
  minutesUnresolved: number;
  affectedAccounts: number;
  brokerWide: boolean;
  unsafeTrading: boolean;
}) {
  const tradingImpactScore = input.unsafeTrading ? 30 : input.errorType.includes("Execution") || input.errorType.includes("Order") ? 20 : input.errorType.includes("Trade Sync") ? 18 : 10;
  const affectedComponentScore =
    input.sourceModule === "Broker Connection" ? 18 :
    input.sourceModule === "EA Bridge" ? 16 :
    input.sourceModule === "Execution Queue" || input.sourceModule === "Order Router" ? 15 :
    input.sourceModule === "MT5 Terminal" ? 14 :
    input.sourceModule === "Database/API" || input.sourceModule === "Permission/Security" ? 17 :
    10;

  const repeatFrequencyScore = Math.min(20, Math.floor(Math.log2(Math.max(1, input.repeatCount))) * 4);
  const dependencyImpactScore = input.brokerWide ? 20 : input.affectedAccounts >= 5 ? 14 : input.affectedAccounts >= 2 ? 10 : 6;
  const unresolvedDurationScore = Math.min(20, Math.floor(input.minutesUnresolved / 30) * 2);

  const breakdown: ErrorSeverityScoreBreakdown = {
    tradingImpactScore,
    affectedComponentScore,
    repeatFrequencyScore,
    dependencyImpactScore,
    unresolvedDurationScore
  };
  const score = Object.values(breakdown).reduce((a, b) => a + b, 0);

  const severity: Mt5ErrorSeverity =
    score >= 85 ? "Emergency" :
    score >= 70 ? "Critical" :
    score >= 55 ? "High" :
    score >= 35 ? "Warning" :
    "Info";

  return { score, severity, breakdown };
}

export function riskLevelFromSeverity(severity: Mt5ErrorSeverity, unresolved: Mt5ErrorResolutionStatus, repeatCount: number): Mt5ErrorRiskLevel {
  const base =
    severity === "Emergency" ? 5 :
    severity === "Critical" ? 4 :
    severity === "High" ? 3 :
    severity === "Warning" ? 2 :
    1;

  const multiplier = unresolved === "Resolved" ? 0.6 : unresolved === "In Progress" ? 0.9 : 1;
  const repeatBoost = repeatCount >= 10 ? 1.2 : repeatCount >= 4 ? 1.1 : 1;
  const score = base * multiplier * repeatBoost;

  if (score >= 4.6) return "Critical";
  if (score >= 3.8) return "High";
  if (score >= 2.6) return "Elevated";
  if (score >= 1.7) return "Moderate";
  return "Low";
}

export function escalationDecision(input: {
  severity: Mt5ErrorSeverity;
  unsafeTrading: boolean;
  repeatCount: number;
  affectedAccounts: number;
  brokerWide: boolean;
  autoRemediationFailed: boolean;
  minutesUnresolved: number;
}) {
  const reasons: string[] = [];
  if (input.severity === "Emergency" || input.severity === "Critical") reasons.push("severity");
  if (input.unsafeTrading) reasons.push("unsafe-trading");
  if (input.repeatCount >= 8) reasons.push("repeat-threshold");
  if (input.affectedAccounts >= 5 || input.brokerWide) reasons.push("blast-radius");
  if (input.autoRemediationFailed) reasons.push("auto-remediation-failed");
  if (input.minutesUnresolved >= 180 && input.severity !== "Info") reasons.push("sla-risk");
  const escalate = reasons.length > 0;

  const assignedRole =
    input.unsafeTrading ? ("Risk Manager" as const) :
    input.severity === "Emergency" ? ("Super Admin" as const) :
    input.severity === "Critical" ? ("Infrastructure Admin" as const) :
    ("Trading Admin" as const);

  return { escalate, assignedRole, reasons };
}

export function categoryFor(log: Pick<Mt5ErrorLog, "sourceModule" | "errorType">): Mt5ErrorCategory["key"] {
  if (log.sourceModule === "MT5 Terminal") return "Terminal errors";
  if (log.sourceModule === "Broker Connection") return "Broker connection errors";
  if (log.errorType === "Account Authentication" || log.errorType === "Broker Login Failed") return "Account authentication errors";
  if (log.sourceModule === "EA Bridge" || log.errorType === "EA Auth Failed") return "EA bridge errors";
  if (log.sourceModule === "Symbol Mapping" || log.errorType === "Symbol Mapping Mismatch") return "Symbol mapping errors";
  if (log.sourceModule === "Market Data" || log.errorType === "Market Data Gap") return "Market data errors";
  if (log.sourceModule === "Spread Monitor" || log.sourceModule === "Slippage Monitor" || log.sourceModule === "Latency Monitor") return "Spread/slippage/latency errors";
  if (log.sourceModule === "Order Router" || log.errorType === "Order Routing Failure") return "Order routing errors";
  if (log.sourceModule === "Execution Queue" || log.errorType === "Execution Queue Backpressure") return "Execution queue errors";
  if (log.sourceModule === "Trade Synchronization" || log.errorType === "Trade Sync Mismatch") return "Trade synchronization errors";
  if (log.sourceModule === "Database/API" || log.errorType === "Database/API Failure") return "Database/API errors";
  if (log.sourceModule === "Permission/Security" || log.errorType === "Permission Denied") return "Permission/security errors";
  return "Database/API errors";
}

export function buildCategories(errors: Mt5ErrorLog[]): Mt5ErrorCategory[] {
  const by = new Map<Mt5ErrorCategory["key"], { count: number; criticalCount: number; top?: Mt5ErrorLog }>();
  for (const e of errors) {
    const key = categoryFor(e);
    const prev = by.get(key) ?? { count: 0, criticalCount: 0 };
    const critical = e.severity === "Critical" || e.severity === "Emergency";
    const candidateTop = !prev.top || (critical && prev.top.severity !== "Emergency" && prev.top.severity !== "Critical") || e.repeatCount > (prev.top?.repeatCount ?? 0) ? e : prev.top;
    by.set(key, { count: prev.count + 1, criticalCount: prev.criticalCount + (critical ? 1 : 0), top: candidateTop });
  }
  const keys: Mt5ErrorCategory["key"][] = [
    "Terminal errors",
    "Broker connection errors",
    "Account authentication errors",
    "EA bridge errors",
    "Symbol mapping errors",
    "Market data errors",
    "Spread/slippage/latency errors",
    "Order routing errors",
    "Execution queue errors",
    "Trade synchronization errors",
    "Database/API errors",
    "Permission/security errors"
  ];
  return keys.map((k) => {
    const row = by.get(k) ?? { count: 0, criticalCount: 0 };
    return { key: k, count: row.count, criticalCount: row.criticalCount, topFingerprint: row.top?.fingerprintHash ?? null, topMessage: row.top?.errorMessage ?? null };
  });
}

export function buildWorkflow(errors: Mt5ErrorLog[], latestDiagnostic: Mt5ErrorAiDiagnostic | null): Mt5ErrorWorkflowNode[] {
  const critical = errors.find((e) => e.severity === "Emergency" || e.severity === "Critical");
  const latestCriticalError = critical ? `${critical.errorId}: ${critical.errorMessage.slice(0, 80)}` : "None";
  const total = errors.length;
  const failed = errors.filter((e) => e.resolutionStatus !== "Resolved" && (e.severity === "Critical" || e.severity === "Emergency")).length;
  const dup = new Set(errors.map((e) => e.fingerprintHash)).size;
  const avg = total ? Math.round(errors.reduce((sum, e) => sum + Math.min(9_000, e.repeatCount * 40 + 250), 0) / total) : 0;
  const ai = latestDiagnostic?.recommendedFix ?? "Prioritize unresolved critical errors; consolidate duplicates using fingerprint hash.";

  const node = (title: Mt5ErrorWorkflowNode["title"], status: Mt5ErrorWorkflowNode["status"], errorCount: number, failedCount: number, averageProcessingMs: number, rec: string): Mt5ErrorWorkflowNode => ({
    title,
    status,
    errorCount,
    failedCount,
    averageProcessingMs,
    latestCriticalError,
    aiRecommendation: rec
  });

  return [
    node("Error Captured", total ? "Healthy" : "Watch", total, 0, avg, "Confirm MT5/bridge/broker telemetry ingestion and normalize timestamps."),
    node("Source Classified", "Healthy", total, 0, avg, "Auto-map to source modules; flag Unknown sources for triage."),
    node("Severity Scored", failed ? "Degraded" : "Healthy", total, failed, avg + 120, "Use impact + dependency + repetition scoring for severity."),
    node("Duplicate Checked", dup < total ? "Healthy" : "Watch", total, 0, avg + 80, "Group by fingerprint; raise repeat trend when frequency increases."),
    node("Root Cause Analyzed", failed ? "Watch" : "Healthy", total, Math.floor(failed / 2), avg + 300, "Correlate heartbeat failures with broker disconnects and downstream execution errors."),
    node("AI Recommendation Generated", "Healthy", total, 0, avg + 200, ai),
    node("Resolution Action Assigned", failed ? "Watch" : "Healthy", total, Math.floor(failed / 3), avg + 500, "Assign to correct role based on module and risk; enforce SLA deadlines."),
    node("Audit Logged", "Healthy", total, 0, avg + 20, "Audit all actions: resolve/reopen/escalate/diagnostics/auto-remediate/export.")
  ];
}

function bucketStartIso(date: Date, minutes: number) {
  const ms = minutes * 60_000;
  const t = Math.floor(date.getTime() / ms) * ms;
  return new Date(t).toISOString();
}

export function buildTrends(errors: Mt5ErrorLog[], bucketMinutes = 30): Mt5ErrorTrendPoint[] {
  const by = new Map<string, Mt5ErrorTrendPoint>();
  for (const e of errors) {
    const start = bucketStartIso(new Date(e.occurredAt), bucketMinutes);
    const prev = by.get(start) ?? { bucketStart: start, total: 0, critical: 0, warning: 0, high: 0, info: 0, emergency: 0, resolved: 0, unresolved: 0 };
    prev.total += 1;
    if (e.severity === "Emergency") prev.emergency += 1;
    else if (e.severity === "Critical") prev.critical += 1;
    else if (e.severity === "High") prev.high += 1;
    else if (e.severity === "Warning") prev.warning += 1;
    else prev.info += 1;
    if (e.resolutionStatus === "Resolved") prev.resolved += 1;
    else prev.unresolved += 1;
    by.set(start, prev);
  }
  return [...by.values()].sort((a, b) => a.bucketStart.localeCompare(b.bucketStart));
}

export function buildFingerprints(errors: Mt5ErrorLog[]): Mt5ErrorFingerprint[] {
  const by = new Map<string, { first: Mt5ErrorLog; last: Mt5ErrorLog; repeatCount: number; score: number }>();
  for (const e of errors) {
    const prev = by.get(e.fingerprintHash);
    const score = Math.min(100, Math.round(e.aiRiskScore + e.repeatCount * 3));
    if (!prev) {
      by.set(e.fingerprintHash, { first: e, last: e, repeatCount: e.repeatCount, score });
      continue;
    }
    if (e.firstSeenAt < prev.first.firstSeenAt) prev.first = e;
    if (e.lastSeenAt > prev.last.lastSeenAt) prev.last = e;
    prev.repeatCount += e.repeatCount;
    prev.score = Math.max(prev.score, score);
  }

  const impactFromScore = (score: number): Mt5ErrorRiskLevel => {
    if (score >= 90) return "Critical";
    if (score >= 75) return "High";
    if (score >= 55) return "Elevated";
    if (score >= 35) return "Moderate";
    return "Low";
  };

  const rows: Mt5ErrorFingerprint[] = [];
  let n = 1;
  for (const [hash, agg] of [...by.entries()].sort((a, b) => b[1].repeatCount - a[1].repeatCount)) {
    const comp = affectedComponent(agg.last);
    rows.push({
      id: `fp-${String(n).padStart(3, "0")}`,
      fingerprintHash: hash,
      errorType: agg.last.errorType,
      sourceModule: agg.last.sourceModule,
      affectedComponentType: comp.type as any,
      affectedComponentId: comp.id,
      repeatCount: agg.repeatCount,
      frequencyScore: Math.min(100, Math.round((agg.repeatCount / Math.max(1, errors.length)) * 100 * 4)),
      impactLevel: impactFromScore(agg.score),
      suggestedPermanentFix: "Add circuit-breaker, retry backoff, and dependency health gating; deploy after canary verification.",
      firstSeenAt: agg.first.firstSeenAt,
      lastSeenAt: agg.last.lastSeenAt,
      createdAt: agg.first.createdAt,
      updatedAt: agg.last.updatedAt
    });
    n += 1;
  }
  return rows;
}

export function proposeDiagnostic(error: Mt5ErrorLog): Mt5ErrorAiDiagnostic {
  const unsafe = error.errorType === "Unsafe Trading Condition" || error.statusAfter === "Unsafe";
  const issueSummary = `${error.sourceModule}: ${error.errorType} (${error.errorCode ?? "no code"})`;
  const rootCause =
    error.errorType === "Heartbeat Timeout" ? "Terminal heartbeat missed; host saturation or bridge disconnect likely." :
    error.errorType === "Broker Disconnect" ? "Broker session unstable; network jitter or server-side throttling detected." :
    error.errorType === "Order Routing Failure" ? "Order router could not enqueue/route; queue backpressure or permission mismatch." :
    error.errorType === "Trade Sync Mismatch" ? "Trade state divergence; reconciliation window exceeded or mapping mismatch." :
    "Mixed signals; correlate with dependency health and recent deployments.";

  const affected = [
    error.broker ? `Broker:${error.broker}` : null,
    error.account ? `Account:${error.account}` : null,
    error.terminal ? `Terminal:${error.terminal}` : null,
    error.eaInstance ? `EA:${error.eaInstance}` : null,
    error.symbol ? `Symbol:${error.symbol}` : null
  ].filter(Boolean) as string[];

  const tradingImpact =
    unsafe ? "Trading path may be unsafe; block new risk until diagnostic confirms recovery." :
    error.errorType.includes("Execution") ? "Execution quality degraded; fills may be delayed or rejected." :
    error.sourceModule === "Broker Connection" ? "Broker connectivity degraded; new orders at risk." :
    "Operational degradation with potential downstream impact.";

  const recommendedFix =
    error.sourceModule === "Broker Connection" ? "Fail over broker session; restart connection worker; validate login health and ping." :
    error.sourceModule === "EA Bridge" ? "Rotate bridge credentials, refresh token, and restart bridge pod; verify heartbeat." :
    error.sourceModule === "Execution Queue" ? "Drain queue, increase workers, apply backpressure guardrails; re-run execution diagnostics." :
    error.sourceModule === "Trade Synchronization" ? "Run reconciliation; re-sync orders/trades; validate symbol mapping and ticket linkage." :
    "Run diagnostics; validate dependencies; apply safe remediation and verify stability.";

  const confidenceScore = Math.max(0.35, Math.min(0.98, 0.55 + error.aiRiskScore / 200));
  const autoRemediationEligible =
    error.sourceModule === "Broker Connection" ||
    error.sourceModule === "EA Bridge" ||
    error.sourceModule === "Execution Queue" ||
    error.errorType === "Account Authentication";

  const escalationRequired = error.severity === "Emergency" || error.severity === "Critical" || unsafe;
  return {
    id: `aid-${error.id}`,
    errorId: error.errorId,
    issueSummary,
    rootCause,
    affectedComponents: affected,
    tradingImpact,
    recommendedFix,
    confidenceScore,
    autoRemediationEligible,
    autoRemediationStatus: "Not Started",
    escalationRequired,
    createdAt: new Date().toISOString(),
    resolvedAt: null
  };
}

export function incidentFrom(error: Mt5ErrorLog, assignedRole: Mt5ErrorIncident["assignedRole"], requiredAction: string): Mt5ErrorIncident {
  const now = new Date();
  const deadlineMinutes =
    error.severity === "Emergency" ? 30 :
    error.severity === "Critical" ? 60 :
    error.severity === "High" ? 120 :
    240;
  const deadline = new Date(now.getTime() + deadlineMinutes * 60_000).toISOString();
  const slaStatus =
    error.severity === "Emergency" ? ("At Risk" as const) :
    error.severity === "Critical" ? ("Within SLA" as const) :
    ("Within SLA" as const);
  return {
    id: `inc-${error.id}`,
    incidentId: `INC-${fnv1aHashHex(error.errorId).toUpperCase()}`,
    errorId: error.errorId,
    severity: error.severity,
    affectedService: error.sourceModule,
    tradingImpact: error.errorType.includes("Execution") ? "Potential fill failures and slippage deterioration." : "Operational degradation; downstream risk possible.",
    escalationStatus: "Open",
    assignedRole,
    requiredAction,
    slaStatus,
    resolutionDeadline: deadline,
    resolvedAt: null,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString()
  };
}

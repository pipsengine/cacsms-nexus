import type { AuditRecord, Mt5Role, ScoreResult } from "@/modules/mt5-infrastructure-and-broker-connectivity/mt5-control-center/types/mt5-control-center.types";
import type {
  ActionResponse,
  AiDiagnosticsResponse,
  AuditResponse,
  BrokerResponseRecord,
  BrokerResponseResponse,
  ExecutionException,
  ExecutionLifecycleNode,
  ExecutionQualityMetric,
  RetryCancellationRecord,
  ExceptionsResponse,
  AiExecutionDiagnostic,
  ExecutionLog,
  ExecutionLogResponse,
  ExecutionLogsResponse,
  ExecutionLogsSummaryResponse,
  ExecutionStatus,
  ExportRequest,
  MarkReviewedRequest,
  QualityAnalyticsResponse,
  RetryCancellationResponse,
  WorkflowResponse
} from "@/modules/mt5-infrastructure-and-broker-connectivity/execution-logs/types/execution-logs.types";
import {
  buildDiagnostics,
  buildExceptions,
  buildWorkflow,
  classifyBrokerResponse,
  executionQualityScore,
  failureClustering,
  toCsv,
  toQualityMetrics,
  unsafeRetryDecision
} from "@/modules/mt5-infrastructure-and-broker-connectivity/execution-logs/algorithms/execution-logs.algorithms";
import { resolveMt5Role } from "../../_lib/access";
import { bindPersistedMt5State, ensureMt5ModuleHydrated } from "../../_lib/persistence";

type ExecutionLogsState = {
  logs: ExecutionLog[];
  brokerResponses: BrokerResponseRecord[];
  retries: RetryCancellationRecord[];
  qualityMetrics: ExecutionQualityMetric[];
  exceptions: ExecutionException[];
  diagnostics: AiExecutionDiagnostic[];
  workflow: ExecutionLifecycleNode[];
  audit: AuditRecord[];
  lastSyncAt: string;
};

const state = bindPersistedMt5State<ExecutionLogsState>("execution-logs", () => ({
  logs: [],
  brokerResponses: [],
  retries: [],
  qualityMetrics: [],
  exceptions: [],
  diagnostics: [],
  workflow: [],
  audit: [],
  lastSyncAt: new Date().toISOString()
}));

await ensureMt5ModuleHydrated("execution-logs");

export function resetExecutionLogsState(override?: Partial<ExecutionLogsState>) {
  state.logs = override?.logs ?? [];
  state.brokerResponses = override?.brokerResponses ?? [];
  state.retries = override?.retries ?? [];
  state.qualityMetrics = override?.qualityMetrics ?? [];
  state.exceptions = override?.exceptions ?? [];
  state.diagnostics = override?.diagnostics ?? [];
  state.workflow = override?.workflow ?? [];
  state.audit = [];
  state.lastSyncAt = new Date().toISOString();
}

const permissions: Record<string, Mt5Role[]> = {
  sync: ["Super Admin", "Infrastructure Admin", "Trading Admin"],
  diagnostics: ["Super Admin", "Infrastructure Admin", "Trading Admin"],
  export: ["Super Admin", "Infrastructure Admin", "Trading Admin", "Risk Manager", "Analyst", "Read-Only Viewer"],
  review: ["Super Admin", "Trading Admin"],
  escalate: ["Super Admin", "Risk Manager", "Trading Admin"],
  remediate: ["Super Admin", "Infrastructure Admin"]
};

export function executionLogsRole(request?: Request): Mt5Role {
  return resolveMt5Role(request);
}

function authorize(role: Mt5Role, action: keyof typeof permissions) {
  if (!permissions[action].includes(role)) throw new Error(`Role "${role}" is not authorized to perform Execution Logs ${action}.`);
}

function audit(role: Mt5Role, action: string, entityId: string, oldValue: unknown, newValue: unknown, request?: Request) {
  state.audit.unshift({
    id: `exe-audit-${Date.now()}-${state.audit.length}`,
    userId: request?.headers.get("x-user-id") ?? role.toLowerCase().replace(/\s+/g, "-"),
    action,
    module: "Execution Logs",
    entityId,
    oldValue,
    newValue,
    ipAddress: request?.headers.get("x-forwarded-for") ?? "system",
    userAgent: request?.headers.get("user-agent") ?? "autonomous-execution-logs",
    timestamp: new Date().toISOString()
  });
}

function findLog(logId: string) {
  const row = state.logs.find((l) => l.logId === logId || l.id === logId);
  if (!row) throw new Error("not found");
  return row;
}

function computeQualityScore(): ScoreResult {
  const total = state.logs.length;
  const success = total ? state.logs.filter((l) => l.executionStatus === "Synced" || l.executionStatus === "Executed").length / total : 1;
  const rejectionRate = total ? state.logs.filter((l) => l.executionStatus === "Rejected").length / total : 0;
  const requoteRate = total ? state.logs.filter((l) => l.executionStatus === "Requoted").length / total : 0;
  const timeRows = state.logs.filter((l) => l.executionTimeMs != null);
  const slipRows = state.logs.filter((l) => l.slippagePoints != null);
  const avgTime = Math.round(timeRows.reduce((sum, l) => sum + (l.executionTimeMs ?? 0), 0) / Math.max(1, timeRows.length));
  const avgSlip = Math.round(slipRows.reduce((sum, l) => sum + (l.slippagePoints ?? 0), 0) / Math.max(1, slipRows.length));
  const feedbackCompleteness = total ? state.logs.filter((l) => l.executionStatus !== "Missing Feedback").length / total : 1;
  const retryRate = total ? Math.min(1, state.logs.reduce((sum, l) => sum + l.retryCount, 0) / total / 3) : 0;
  const timeoutRate = total ? state.logs.filter((l) => l.executionStatus === "Timed Out").length / total : 0;
  return executionQualityScore({ successRate: success, averageExecutionTimeMs: avgTime, averageSlippagePoints: avgSlip, rejectionRate, requoteRate, feedbackCompletenessRate: feedbackCompleteness, retryRate, timeoutRate });
}

export function summary(role: Mt5Role): ExecutionLogsSummaryResponse {
  const now = new Date().toISOString();
  const total = state.logs.length;
  const successful = state.logs.filter((l) => l.executionStatus === "Executed" || l.executionStatus === "Synced").length;
  const failed = state.logs.filter((l) => l.executionStatus === "Failed" || l.executionStatus === "Timed Out" || l.executionStatus === "Missing Feedback").length;
  const rejected = state.logs.filter((l) => l.executionStatus === "Rejected").length;
  const retried = state.logs.filter((l) => l.retryCount > 0).length;
  const cancelled = state.logs.filter((l) => l.executionStatus === "Cancelled").length;
  const pending = state.logs.filter((l) => l.executionStatus === "Pending" || l.executionStatus === "Sent" || l.executionStatus === "Delivered").length;
  const timeRows = state.logs.filter((l) => l.executionTimeMs != null);
  const slipRows = state.logs.filter((l) => l.slippagePoints != null);
  const avgMs = Math.round(timeRows.reduce((sum, l) => sum + (l.executionTimeMs ?? 0), 0) / Math.max(1, timeRows.length));
  const avgSlip = Math.round(slipRows.reduce((sum, l) => sum + (l.slippagePoints ?? 0), 0) / Math.max(1, slipRows.length));
  const requotes = state.logs.filter((l) => l.executionStatus === "Requoted").length;
  const highest = state.logs.find((l) => l.riskLevel === "Critical") ?? state.logs[0];
  const quality = computeQualityScore();

  const status = (value: number, warn: number, crit: number) => (value >= crit ? "Critical" : value >= warn ? "Degraded" : "Healthy");

  const kpis: ExecutionLogsSummaryResponse["kpis"] = [
    { label: "Total Execution Events", value: String(total), status: "Healthy", detail: `Last sync: ${state.lastSyncAt}`, updatedAt: now },
    { label: "Successful Executions", value: String(successful), status: "Healthy", detail: "Executed or synced successfully.", updatedAt: now },
    { label: "Failed Executions", value: String(failed), status: status(failed, 10, 20), detail: "Failed, timed out, or missing feedback.", updatedAt: now },
    { label: "Rejected Executions", value: String(rejected), status: status(rejected, 10, 20), detail: "Rejected by broker response.", updatedAt: now },
    { label: "Retried Executions", value: String(retried), status: status(retried, 12, 24), detail: "Executions that had retries.", updatedAt: now },
    { label: "Cancelled Executions", value: String(cancelled), status: status(cancelled, 8, 15), detail: "Cancelled by operator or gates.", updatedAt: now },
    { label: "Pending Confirmations", value: String(pending), status: status(pending, 15, 30), detail: "Awaiting ticket/feedback/fill confirmation.", updatedAt: now },
    { label: "Average Execution Time", value: `${avgMs}ms`, status: avgMs >= 2000 ? "Degraded" : avgMs >= 1200 ? "Watch" : "Healthy", detail: "Average execution time for completed feedback.", updatedAt: now },
    { label: "Average Slippage", value: `${avgSlip} pts`, status: Math.abs(avgSlip) >= 18 ? "Degraded" : Math.abs(avgSlip) >= 10 ? "Watch" : "Healthy", detail: "Direction-adjusted slippage magnitude.", updatedAt: now },
    { label: "Requote Count", value: String(requotes), status: status(requotes, 10, 18), detail: "Requotes / price changed patterns.", updatedAt: now },
    { label: "Highest Risk Execution", value: highest?.executionId ?? "—", status: highest?.riskLevel === "Critical" ? "Critical" : highest?.riskLevel === "High" ? "Degraded" : "Watch", detail: highest?.brokerResponseMessage ?? highest?.executionStatus ?? "—", updatedAt: now },
    { label: "Execution Quality Score", value: `${quality.score}/100`, status: quality.rating === "Critical" ? "Critical" : quality.rating === "High Risk" ? "Degraded" : quality.rating === "Degraded" ? "Watch" : "Healthy", detail: "Composite score across speed, slippage, rejections, feedback, and retries.", updatedAt: now }
  ];

  return { meta: { timestamp: now, currentRole: role, streamEndpoint: "/api/mt5/execution-logs/events-stream" }, kpis, executionQualityScore: quality };
}

export function workflow(): WorkflowResponse {
  const latest = state.diagnostics[0] ?? null;
  state.workflow = buildWorkflow(state.logs, latest);
  return { meta: { timestamp: new Date().toISOString() }, workflow: state.workflow };
}

export function listLogs(input: { search?: string; status?: ExecutionStatus; brokerId?: string; symbol?: string; reviewed?: string; page?: number; pageSize?: number }): ExecutionLogsResponse {
  const search = input.search?.trim().toLowerCase() ?? "";
  const page = input.page ?? 1;
  const pageSize = input.pageSize ?? 75;

  const filtered = state.logs.filter((l) => {
    const matchesSearch =
      !search ||
      [
        l.logId,
        l.executionId,
        l.orderId,
        l.signalId ?? "",
        l.strategyId,
        l.account,
        l.broker,
        l.terminal,
        l.eaInstance ?? "",
        l.normalizedSymbol,
        l.direction,
        l.orderType,
        l.executionStatus,
        l.brokerResponseCode ?? "",
        l.brokerResponseMessage ?? "",
        l.mt5Ticket ?? "",
        l.riskLevel
      ]
        .join(" ")
        .toLowerCase()
        .includes(search);

    const matchesStatus = input.status ? l.executionStatus === input.status : true;
    const matchesBroker = input.brokerId ? l.brokerId === input.brokerId : true;
    const matchesSymbol = input.symbol ? l.normalizedSymbol === input.symbol : true;
    const matchesReviewed = input.reviewed ? l.reviewedStatus === (input.reviewed as any) : true;
    return matchesSearch && matchesStatus && matchesBroker && matchesSymbol && matchesReviewed;
  });

  const sorted = [...filtered].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  const start = (page - 1) * pageSize;
  const slice = sorted.slice(start, start + pageSize);
  return { meta: { timestamp: new Date().toISOString(), total: filtered.length, page, pageSize }, logs: slice };
}

export function logDetail(logId: string): ExecutionLogResponse {
  return { meta: { timestamp: new Date().toISOString() }, log: findLog(logId) };
}

export function brokerResponse(logId: string): BrokerResponseResponse {
  const log = findLog(logId);
  const resp = state.brokerResponses.find((r) => r.executionLogId === log.id);
  if (!resp) throw new Error("not found");
  return { meta: { timestamp: new Date().toISOString() }, brokerResponse: resp };
}

export function retryCancellation(logId: string): RetryCancellationResponse {
  const log = findLog(logId);
  const rc = state.retries.find((r) => r.originalExecutionId === log.executionId);
  if (!rc) throw new Error("not found");
  return { meta: { timestamp: new Date().toISOString() }, retryCancellation: rc };
}

export function qualityAnalytics(): QualityAnalyticsResponse {
  state.qualityMetrics = toQualityMetrics(state.logs, state.brokerResponses);
  return { meta: { timestamp: new Date().toISOString(), total: state.qualityMetrics.length }, metrics: state.qualityMetrics };
}

export function exceptions(filter?: string): ExceptionsResponse {
  state.exceptions = buildExceptions(state.logs, state.brokerResponses);
  const f = filter?.trim().toLowerCase() ?? "";
  const rows = f ? state.exceptions.filter((e) => [e.exceptionType, e.severity, e.resolutionStatus, e.broker, e.account, e.symbol].join(" ").toLowerCase().includes(f)) : state.exceptions;
  return { meta: { timestamp: new Date().toISOString(), total: rows.length }, exceptions: rows };
}

export function aiDiagnostics(): AiDiagnosticsResponse {
  state.diagnostics = buildDiagnostics(state.logs, state.brokerResponses, state.retries);
  return { meta: { timestamp: new Date().toISOString(), total: state.diagnostics.length }, diagnostics: state.diagnostics };
}

export function auditTrail(): AuditResponse {
  return { meta: { timestamp: new Date().toISOString(), total: state.audit.length }, audit: state.audit.slice(0, 400) };
}

export function sync(role: Mt5Role, request?: Request): ActionResponse {
  authorize(role, "sync");
  const before = { count: state.logs.length, lastSyncAt: state.lastSyncAt };
  const now = new Date();
  const n = state.logs.length + 1;
  const log: ExecutionLog = {
    id: `log-${String(n).padStart(3, "0")}`,
    logId: `LOG-${String(1500 + n)}`,
    occurredAt: now.toISOString(),
    executionId: `EXE-${String(23000 + n)}`,
    orderId: `ORD-${String(93000 + n)}`,
    signalId: `SIG-${String(7000 + n)}`,
    strategyId: "S-101",
    sourceEngine: "Router Engine",
    accountId: `acct-${(n % 10) + 1}`,
    account: `A${(n % 10) + 1}-LIVE`,
    brokerId: "broker-icm",
    broker: "IC Markets",
    terminalId: `term-${(n % 7) + 1}`,
    terminal: `Terminal-${(n % 7) + 1}`,
    eaInstanceId: `ea-${(n % 5) + 1}`,
    eaInstance: `EA-${(n % 5) + 1}`,
    symbol: "EURUSD",
    normalizedSymbol: "EURUSD",
    brokerSymbol: "EURUSD.1",
    direction: n % 2 === 0 ? "Buy" : "Sell",
    orderType: "Market",
    volume: 1,
    requestedPrice: 1.1,
    stopLoss: 1.098,
    takeProfit: 1.103,
    timeInForce: "IOC",
    expiryTime: null,
    mt5Ticket: n % 4 === 0 ? null : String(800000 + n),
    executedPrice: n % 4 === 0 ? null : 1.1001,
    executedVolume: n % 4 === 0 ? null : 1,
    executionStatus: n % 9 === 0 ? "Rejected" : n % 7 === 0 ? "Timed Out" : "Synced",
    fillStatus: n % 4 === 0 ? "Unknown" : "Filled",
    brokerResponseCode: n % 9 === 0 ? "NO_MONEY" : n % 7 === 0 ? "TIMEOUT" : "OK",
    brokerResponseMessage: n % 9 === 0 ? "Insufficient margin" : n % 7 === 0 ? "Broker timeout" : "Accepted",
    slippagePoints: n % 9 === 0 ? null : Math.round((n % 9) - 4),
    spreadAtExecution: n % 9 === 0 ? null : 12,
    executionTimeMs: n % 7 === 0 ? null : 780,
    retryCount: n % 5 === 0 ? 1 : 0,
    riskLevel: n % 9 === 0 ? "High" : n % 7 === 0 ? "Critical" : "Moderate",
    reviewedStatus: "Unreviewed",
    reviewedBy: null,
    reviewedAt: null,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString()
  };
  state.logs.unshift(log);
  state.lastSyncAt = now.toISOString();
  audit(role, "SYNC_EXECUTIONS", "SYNC", before, { count: state.logs.length, lastSyncAt: state.lastSyncAt }, request);
  return { meta: { timestamp: now.toISOString() }, ok: true, message: "Synced latest executions.", affected: [log.logId] };
}

export function markReviewed(logId: string, payload: MarkReviewedRequest, role: Mt5Role, request?: Request): ActionResponse {
  authorize(role, "review");
  const log = findLog(logId);
  const before = { reviewedStatus: log.reviewedStatus, reviewedBy: log.reviewedBy };
  log.reviewedStatus = "Reviewed";
  log.reviewedBy = payload.reviewedBy ?? request?.headers.get("x-user-id") ?? role.toLowerCase().replace(/\s+/g, "-");
  log.reviewedAt = new Date().toISOString();
  log.updatedAt = new Date().toISOString();
  audit(role, "MARK_REVIEWED", log.logId, before, { reviewedStatus: log.reviewedStatus, reviewedBy: log.reviewedBy }, request);
  return { meta: { timestamp: new Date().toISOString() }, ok: true, message: `Marked reviewed: ${log.logId}.`, affected: [log.logId] };
}

export function escalate(logId: string, payload: { requiredAction: string }, role: Mt5Role, request?: Request): ActionResponse {
  authorize(role, "escalate");
  const log = findLog(logId);
  audit(role, "ESCALATE_EXECUTION", log.logId, null, { requiredAction: payload.requiredAction }, request);
  return { meta: { timestamp: new Date().toISOString() }, ok: true, message: `Escalated execution: ${log.logId}.`, affected: [log.logId] };
}

export function diagnostics(role: Mt5Role, logId: string | null, request?: Request): ActionResponse {
  authorize(role, "diagnostics");
  const targets = logId ? [findLog(logId)] : state.logs.filter((l) => l.executionStatus === "Failed" || l.executionStatus === "Rejected" || l.executionStatus === "Timed Out" || l.executionStatus === "Missing Feedback").slice(0, 6);
  state.diagnostics = buildDiagnostics(state.logs, state.brokerResponses, state.retries);
  for (const t of targets) {
    audit(role, "RUN_EXECUTION_DIAGNOSTICS", t.logId, null, { executionId: t.executionId }, request);
  }
  const clusters = failureClustering(state.logs);
  audit(role, "FAILURE_CLUSTERING", "CLUSTERS", null, { clusters }, request);
  return { meta: { timestamp: new Date().toISOString() }, ok: true, message: "Diagnostics generated.", affected: targets.map((t) => t.logId) };
}

export function autoRemediate(role: Mt5Role, logId: string, request?: Request): ActionResponse {
  authorize(role, "remediate");
  const log = findLog(logId);
  const before = { executionStatus: log.executionStatus, retryCount: log.retryCount };
  const unsafe = unsafeRetryDecision({
    mt5TicketExists: Boolean(log.mt5Ticket),
    executionStatus: log.executionStatus,
    feedbackMissing: log.executionStatus === "Missing Feedback" || log.executionStatus === "Timed Out",
    marketMovedBeyondTolerance: false,
    riskExpired: false,
    duplicateOrderRisk: log.executionStatus === "Timed Out",
    retryCount: log.retryCount,
    maxRetryCount: 3
  });

  if (!unsafe.safe) {
    audit(role, "AUTO_REMEDIATE_BLOCKED", log.logId, before, { reasons: unsafe.reasons }, request);
    return { meta: { timestamp: new Date().toISOString() }, ok: false, message: `Auto-remediation blocked: ${unsafe.reasons.join(", ")}`, affected: [log.logId] };
  }

  log.retryCount += 1;
  log.executionStatus = "Synced";
  log.reviewedStatus = "Unreviewed";
  log.updatedAt = new Date().toISOString();
  audit(role, "AUTO_REMEDIATE", log.logId, before, { executionStatus: log.executionStatus, retryCount: log.retryCount }, request);
  return { meta: { timestamp: new Date().toISOString() }, ok: true, message: `Auto-remediation applied: ${log.logId}.`, affected: [log.logId] };
}

export function exportLogs(payload: ExportRequest, role: Mt5Role, request?: Request): ActionResponse {
  authorize(role, "export");
  const before = { lastExportAt: null };
  const filtered = listLogs({
    search: payload.filters?.search,
    status: payload.filters?.status && payload.filters.status !== "all" ? payload.filters.status : undefined,
    brokerId: payload.filters?.brokerId && payload.filters.brokerId !== "all" ? payload.filters.brokerId : undefined,
    symbol: payload.filters?.symbol && payload.filters.symbol !== "all" ? payload.filters.symbol : undefined,
    reviewed: payload.filters?.reviewed && payload.filters.reviewed !== "all" ? payload.filters.reviewed : undefined,
    page: 1,
    pageSize: 5000
  }).logs;
  const content = payload.format === "csv" ? toCsv(filtered) : JSON.stringify({ generatedAt: new Date().toISOString(), total: filtered.length, logs: filtered }, null, 2);
  audit(role, "EXPORT_EXECUTION_LOGS", "EXPORT", before, { format: payload.format, total: filtered.length }, request);
  return { meta: { timestamp: new Date().toISOString() }, ok: true, message: content };
}

export function refreshDerived() {
  state.brokerResponses = state.brokerResponses.map((r) => {
    const classified = classifyBrokerResponse(r);
    return {
      ...r,
      rejectionReason: classified.rejectionReason,
      requoteDetected: classified.flags.requote,
      offQuotesDetected: classified.flags.offQuotes,
      marginRejectionDetected: classified.flags.insufficientMargin,
      invalidVolumeDetected: classified.flags.invalidVolume,
      tradeContextBusyDetected: classified.flags.tradeContextBusy,
      requiredFix: classified.requiredFix,
      aiExplanation: classified.aiExplanation
    };
  });
  state.qualityMetrics = toQualityMetrics(state.logs, state.brokerResponses);
  state.exceptions = buildExceptions(state.logs, state.brokerResponses);
  state.diagnostics = buildDiagnostics(state.logs, state.brokerResponses, state.retries);
  state.workflow = buildWorkflow(state.logs, state.diagnostics[0] ?? null);
}


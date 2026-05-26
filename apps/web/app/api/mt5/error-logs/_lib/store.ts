import type { AuditRecord, Mt5Role, ScoreResult } from "@/modules/mt5-infrastructure-and-broker-connectivity/mt5-control-center/types/mt5-control-center.types";
import {
  buildCategories,
  buildFingerprints,
  buildTrends,
  buildWorkflow,
  escalationDecision,
  fingerprintFor,
  incidentFrom,
  proposeDiagnostic,
  riskLevelFromSeverity
} from "@/modules/mt5-infrastructure-and-broker-connectivity/mt5-error-logs/algorithms/mt5-error-logs.algorithms";
import { createMt5ErrorLogsSeed } from "@/modules/mt5-infrastructure-and-broker-connectivity/mt5-error-logs/data/mt5-error-logs.mock";
import type {
  ActionResponse,
  AiDiagnosticsResponse,
  AuditResponse,
  CategoriesResponse,
  ErrorLogResponse,
  ErrorLogsResponse,
  EscalateRequest,
  ExportRequest,
  IncidentsResponse,
  Mt5ErrorAiDiagnostic,
  Mt5ErrorIncident,
  Mt5ErrorLog,
  Mt5ErrorResolution,
  Mt5ErrorResolutionStatus,
  Mt5ErrorSeverity,
  Mt5ErrorSourceModule,
  Mt5ErrorType,
  ReopenRequest,
  RepeatedResponse,
  ResolveRequest,
  ResolutionsResponse,
  TrendsResponse,
  WorkflowResponse,
  Mt5ErrorLogsSummaryResponse
} from "@/modules/mt5-infrastructure-and-broker-connectivity/mt5-error-logs/types/mt5-error-logs.types";
import { resolveMt5Role } from "../../_lib/access";

const seed = createMt5ErrorLogsSeed();

type ErrorLogsState = {
  errors: Mt5ErrorLog[];
  diagnostics: Mt5ErrorAiDiagnostic[];
  incidents: Mt5ErrorIncident[];
  resolutions: Mt5ErrorResolution[];
  audits: AuditRecord[];
  lastSyncAt: string;
};

const state: ErrorLogsState = {
  errors: seed.errors,
  diagnostics: seed.diagnostics,
  incidents: seed.incidents,
  resolutions: seed.resolutions,
  audits: [],
  lastSyncAt: new Date().toISOString()
};

export function resetErrorLogsState() {
  const next = createMt5ErrorLogsSeed();
  state.errors = next.errors;
  state.diagnostics = next.diagnostics;
  state.incidents = next.incidents;
  state.resolutions = next.resolutions;
  state.audits = [];
  state.lastSyncAt = new Date().toISOString();
}

const permissions: Record<string, Mt5Role[]> = {
  sync: ["Super Admin", "Infrastructure Admin", "Trading Admin"],
  export: ["Super Admin", "Infrastructure Admin", "Trading Admin", "Risk Manager", "Analyst", "Read-Only Viewer"],
  diagnostics: ["Super Admin", "Infrastructure Admin", "Trading Admin", "Risk Manager"],
  resolve: ["Super Admin", "Infrastructure Admin", "Trading Admin"],
  reopen: ["Super Admin", "Infrastructure Admin", "Trading Admin"],
  escalate: ["Super Admin", "Infrastructure Admin", "Risk Manager"],
  remediate: ["Super Admin", "Infrastructure Admin"]
};

export function errorLogsRole(request?: Request): Mt5Role {
  return resolveMt5Role(request);
}

function authorize(role: Mt5Role, action: keyof typeof permissions) {
  if (!permissions[action].includes(role)) throw new Error(`Role "${role}" is not authorized to perform MT5 Error Logs ${action}.`);
}

function audit(role: Mt5Role, action: string, entityId: string, oldValue: unknown, newValue: unknown, request?: Request) {
  state.audits.unshift({
    id: `err-audit-${Date.now()}-${state.audits.length}`,
    userId: request?.headers.get("x-user-id") ?? role.toLowerCase().replace(/\s+/g, "-"),
    action,
    module: "MT5 Error Logs",
    entityId,
    oldValue,
    newValue,
    ipAddress: request?.headers.get("x-forwarded-for") ?? "system",
    userAgent: request?.headers.get("user-agent") ?? "autonomous-mt5-error-logs",
    timestamp: new Date().toISOString()
  });
}

function findError(errorId: string) {
  const row = state.errors.find((e) => e.errorId === errorId || e.id === errorId);
  if (!row) throw new Error("not found");
  return row;
}

function isInfraModule(mod: Mt5ErrorSourceModule) {
  return mod === "MT5 Terminal" || mod === "Broker Connection" || mod === "Database/API" || mod === "Market Data" || mod === "Infrastructure" || mod === "Permission/Security";
}

function isTradingModule(mod: Mt5ErrorSourceModule) {
  return mod === "Order Router" || mod === "Execution Queue" || mod === "Trade Synchronization" || mod === "Account Sync" || mod === "Spread Monitor" || mod === "Slippage Monitor" || mod === "Latency Monitor";
}

function canResolve(role: Mt5Role, error: Mt5ErrorLog) {
  if (role === "Super Admin") return true;
  if (role === "Infrastructure Admin") return isInfraModule(error.sourceModule);
  if (role === "Trading Admin") return isTradingModule(error.sourceModule) || error.errorType.includes("Execution") || error.errorType.includes("Order");
  return false;
}

function computeAiRiskScore(): ScoreResult {
  const avg = Math.round(state.errors.reduce((sum, e) => sum + e.aiRiskScore, 0) / Math.max(1, state.errors.length));
  const critical = state.errors.filter((e) => e.severity === "Emergency" || e.severity === "Critical").length;
  const unresolved = state.errors.filter((e) => e.resolutionStatus !== "Resolved").length;
  const repeated = buildFingerprints(state.errors).filter((f) => f.repeatCount >= 10).length;
  const rating =
    avg >= 85 ? "Critical" :
    avg >= 70 ? "High Risk" :
    avg >= 55 ? "Degraded" :
    avg >= 40 ? "Healthy" :
    "Excellent";
  return { score: avg, rating, factors: { critical, unresolved, repeated } };
}

function kpiStatus(value: number, warn: number, crit: number) {
  if (value >= crit) return "Critical" as const;
  if (value >= warn) return "Degraded" as const;
  return "Healthy" as const;
}

export function summary(role: Mt5Role): Mt5ErrorLogsSummaryResponse {
  const now = new Date().toISOString();
  const total = state.errors.length;
  const critical = state.errors.filter((e) => e.severity === "Critical" || e.severity === "Emergency").length;
  const warning = state.errors.filter((e) => e.severity === "Warning").length;
  const resolved = state.errors.filter((e) => e.resolutionStatus === "Resolved").length;
  const unresolved = total - resolved;
  const fingerprints = buildFingerprints(state.errors);
  const repeated = fingerprints.filter((f) => f.repeatCount >= 10).length;
  const terminal = state.errors.filter((e) => e.sourceModule === "MT5 Terminal").length;
  const broker = state.errors.filter((e) => e.sourceModule === "Broker Connection").length;
  const bridge = state.errors.filter((e) => e.sourceModule === "EA Bridge").length;
  const execution = state.errors.filter((e) => e.errorType.includes("Execution")).length;
  const sync = state.errors.filter((e) => e.sourceModule === "Trade Synchronization" || e.sourceModule === "Account Sync").length;

  const aiRiskScore = computeAiRiskScore();

  const kpis: Mt5ErrorLogsSummaryResponse["kpis"] = [
    { label: "Total Errors", value: String(total), status: kpiStatus(total, 80, 130), detail: `Last sync: ${state.lastSyncAt}`, updatedAt: now },
    { label: "Critical Errors", value: String(critical), status: kpiStatus(critical, 8, 16), detail: "Critical/Emergency errors needing urgent attention.", updatedAt: now },
    { label: "Warning Errors", value: String(warning), status: kpiStatus(warning, 20, 40), detail: "Warnings that may cascade into higher severity.", updatedAt: now },
    { label: "Resolved Errors", value: String(resolved), status: "Healthy", detail: "Errors marked resolved with resolution notes and audits.", updatedAt: now },
    { label: "Unresolved Errors", value: String(unresolved), status: kpiStatus(unresolved, 40, 70), detail: "Unresolved or reopened errors.", updatedAt: now },
    { label: "Repeated Errors", value: String(repeated), status: kpiStatus(repeated, 8, 15), detail: "High-frequency fingerprints indicating recurring issues.", updatedAt: now },
    { label: "Terminal Errors", value: String(terminal), status: "Healthy", detail: "Terminal runtime and heartbeat failures.", updatedAt: now },
    { label: "Broker Errors", value: String(broker), status: kpiStatus(broker, 15, 28), detail: "Broker connectivity and login failures.", updatedAt: now },
    { label: "EA Bridge Errors", value: String(bridge), status: kpiStatus(bridge, 12, 22), detail: "EA bridge auth/session/routing issues.", updatedAt: now },
    { label: "Order Execution Errors", value: String(execution), status: kpiStatus(execution, 10, 18), detail: "Execution failures affecting fills/queue/routers.", updatedAt: now },
    { label: "Sync Errors", value: String(sync), status: kpiStatus(sync, 10, 18), detail: "Account and trade synchronization mismatch patterns.", updatedAt: now },
    { label: "AI Risk Score", value: String(aiRiskScore.score), status: aiRiskScore.rating === "Critical" ? "Critical" : aiRiskScore.rating === "High Risk" ? "Degraded" : "Healthy", detail: "Composite score from severity, repeats, and blast radius.", updatedAt: now }
  ];

  return { meta: { timestamp: now, currentRole: role, streamEndpoint: "/api/mt5/error-logs/events-stream" }, kpis, aiRiskScore };
}

export function workflow(): WorkflowResponse {
  const latest = state.diagnostics[0] ?? null;
  return { meta: { timestamp: new Date().toISOString() }, workflow: buildWorkflow(state.errors, latest) };
}

export function listErrors(input: { search?: string; severity?: Mt5ErrorSeverity; module?: Mt5ErrorSourceModule; status?: Mt5ErrorResolutionStatus; brokerId?: string; page?: number; pageSize?: number }): ErrorLogsResponse {
  const search = input.search?.trim().toLowerCase() ?? "";
  const page = input.page ?? 1;
  const pageSize = input.pageSize ?? 75;
  const filtered = state.errors.filter((e) => {
    const matchesSearch =
      !search ||
      [
        e.errorId,
        e.sourceModule,
        e.errorType,
        e.severity,
        e.broker ?? "",
        e.account ?? "",
        e.terminal ?? "",
        e.eaInstance ?? "",
        e.symbol ?? "",
        e.orderId ?? "",
        e.mt5Ticket ?? "",
        e.errorCode ?? "",
        e.errorMessage,
        e.resolutionStatus,
        e.assignedTo ?? "",
        e.riskLevel,
        e.fingerprintHash
      ]
        .join(" ")
        .toLowerCase()
        .includes(search);
    const matchesSeverity = input.severity ? e.severity === input.severity : true;
    const matchesModule = input.module ? e.sourceModule === input.module : true;
    const matchesStatus = input.status ? e.resolutionStatus === input.status : true;
    const matchesBroker = input.brokerId ? e.brokerId === input.brokerId : true;
    return matchesSearch && matchesSeverity && matchesModule && matchesStatus && matchesBroker;
  });

  const sorted = [...filtered].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  const start = (page - 1) * pageSize;
  const slice = sorted.slice(start, start + pageSize);
  return { meta: { timestamp: new Date().toISOString(), total: filtered.length, page, pageSize }, errors: slice };
}

export function errorDetail(errorId: string): ErrorLogResponse {
  return { meta: { timestamp: new Date().toISOString() }, error: findError(errorId) };
}

export function categories(): CategoriesResponse {
  const rows = buildCategories(state.errors);
  return { meta: { timestamp: new Date().toISOString(), total: rows.length }, categories: rows };
}

export function trends(): TrendsResponse {
  const points = buildTrends(state.errors, 30);
  return { meta: { timestamp: new Date().toISOString(), total: points.length }, points };
}

export function repeated(): RepeatedResponse {
  const fingerprints = buildFingerprints(state.errors);
  return { meta: { timestamp: new Date().toISOString(), total: fingerprints.length }, fingerprints };
}

export function incidents(): IncidentsResponse {
  return { meta: { timestamp: new Date().toISOString(), total: state.incidents.length }, incidents: [...state.incidents].sort((a, b) => b.createdAt.localeCompare(a.createdAt)) };
}

export function aiDiagnostics(): AiDiagnosticsResponse {
  return { meta: { timestamp: new Date().toISOString(), total: state.diagnostics.length }, diagnostics: state.diagnostics.slice(0, 100) };
}

export function resolutions(): ResolutionsResponse {
  return { meta: { timestamp: new Date().toISOString(), total: state.resolutions.length }, resolutions: state.resolutions.slice(0, 200) };
}

export function auditTrail(): AuditResponse {
  return { meta: { timestamp: new Date().toISOString(), total: state.audits.length }, audit: state.audits.slice(0, 300) };
}

export function sync(role: Mt5Role, request?: Request): ActionResponse {
  authorize(role, "sync");
  const before = { count: state.errors.length, lastSyncAt: state.lastSyncAt };
  const now = new Date();
  const n = state.errors.length + 1;
  const template: { module: Mt5ErrorSourceModule; type: Mt5ErrorType; code: string; message: string }[] = [
    { module: "Broker Connection", type: "Broker Disconnect", code: "10054", message: `Broker socket reset by peer during keep-alive cycle ${n}` },
    { module: "Execution Queue", type: "Execution Queue Backpressure", code: "Q-429", message: `Execution queue backpressure: depth=${900 + (n % 300)}; rejected=${(n % 10) + 1}` },
    { module: "MT5 Terminal", type: "Heartbeat Timeout", code: "HB-408", message: `Terminal heartbeat missed for ${25 + (n % 7) * 5}s on host VM-${(n % 5) + 1}` }
  ];
  const t = template[n % template.length]!;
  const severity: Mt5ErrorSeverity = n % 11 === 0 ? "Emergency" : n % 7 === 0 ? "Critical" : n % 4 === 0 ? "High" : "Warning";
  const resolutionStatus: Mt5ErrorResolutionStatus = "Unresolved";
  const error: Mt5ErrorLog = {
    id: `err-${String(n).padStart(3, "0")}`,
    errorId: `ERR-${String(1000 + n)}`,
    occurredAt: now.toISOString(),
    sourceModule: t.module,
    errorType: t.type,
    severity,
    brokerId: "broker-icm",
    broker: "IC Markets",
    accountId: `acct-${(n % 9) + 1}`,
    account: `A${(n % 9) + 1}-CHALLENGE`,
    terminalId: `term-${(n % 7) + 1}`,
    terminal: `Terminal-${(n % 7) + 1}`,
    eaInstanceId: n % 3 === 0 ? `ea-${(n % 5) + 1}` : null,
    eaInstance: n % 3 === 0 ? `EA-${(n % 5) + 1}` : null,
    symbol: n % 5 === 0 ? "XAUUSD" : null,
    orderId: t.type.includes("Execution") ? `order-${100000 + n}` : null,
    tradeId: null,
    mt5Ticket: t.type.includes("Execution") ? String(700000 + n) : null,
    errorCode: t.code,
    errorMessage: t.message,
    technicalDetails: `sync_ingestion=true; batch=${n};`,
    stackTrace: `Error: ${t.type}\n  at Mt5Connector.handle\n  at Worker.run\n  at Scheduler.tick`,
    payloadHash: `pl-${String(n).padStart(4, "0")}`,
    statusBefore: "Healthy",
    statusAfter: severity === "Emergency" || severity === "Critical" ? "Unsafe" : "Degraded",
    repeatCount: (n % 9) + 1,
    firstSeenAt: now.toISOString(),
    lastSeenAt: now.toISOString(),
    resolutionStatus,
    assignedTo: null,
    riskLevel: riskLevelFromSeverity(severity, resolutionStatus, (n % 9) + 1),
    environment: "Production",
    hostMachine: `MT5-HOST-${(n % 6) + 1}`,
    fingerprintHash: "",
    aiRiskScore: Math.min(100, 40 + (severity === "Emergency" ? 50 : severity === "Critical" ? 40 : severity === "High" ? 30 : 18) + (n % 10)),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString()
  };
  error.fingerprintHash = fingerprintFor(error);

  state.errors.unshift(error);
  state.lastSyncAt = now.toISOString();
  audit(role, "SYNC_ERRORS", "SYNC", before, { count: state.errors.length, lastSyncAt: state.lastSyncAt }, request);
  return { meta: { timestamp: now.toISOString() }, ok: true, message: "Synced latest MT5 errors.", affected: [error.errorId] };
}

export function resolveError(errorId: string, payload: ResolveRequest, role: Mt5Role, request?: Request): ActionResponse {
  authorize(role, "resolve");
  const error = findError(errorId);
  if (!canResolve(role, error)) throw new Error(`Role "${role}" is not authorized to resolve this error.`);
  const before = { resolutionStatus: error.resolutionStatus, assignedTo: error.assignedTo };
  error.resolutionStatus = "Resolved";
  error.assignedTo = payload.assignedTo ?? error.assignedTo ?? request?.headers.get("x-user-id") ?? null;
  error.updatedAt = new Date().toISOString();
  error.riskLevel = riskLevelFromSeverity(error.severity, error.resolutionStatus, error.repeatCount);
  state.resolutions.unshift({
    id: `res-${Date.now()}-${state.resolutions.length}`,
    errorId: error.errorId,
    resolutionAction: payload.resolutionAction,
    resolutionNote: payload.resolutionNote,
    resolvedBy: request?.headers.get("x-user-id") ?? role.toLowerCase().replace(/\s+/g, "-"),
    resolvedAt: new Date().toISOString(),
    reopenedBy: null,
    reopenedAt: null,
    reopenReason: null,
    createdAt: new Date().toISOString()
  });
  audit(role, "MARK_RESOLVED", error.errorId, before, { resolutionStatus: error.resolutionStatus, assignedTo: error.assignedTo }, request);
  return { meta: { timestamp: new Date().toISOString() }, ok: true, message: `Resolved ${error.errorId}.`, affected: [error.errorId] };
}

export function reopenError(errorId: string, payload: ReopenRequest, role: Mt5Role, request?: Request): ActionResponse {
  authorize(role, "reopen");
  const error = findError(errorId);
  const before = { resolutionStatus: error.resolutionStatus };
  error.resolutionStatus = "Reopened";
  error.updatedAt = new Date().toISOString();
  error.riskLevel = riskLevelFromSeverity(error.severity, error.resolutionStatus, error.repeatCount);
  state.resolutions.unshift({
    id: `res-${Date.now()}-${state.resolutions.length}`,
    errorId: error.errorId,
    resolutionAction: "Reopen",
    resolutionNote: payload.reopenReason,
    resolvedBy: null,
    resolvedAt: null,
    reopenedBy: request?.headers.get("x-user-id") ?? role.toLowerCase().replace(/\s+/g, "-"),
    reopenedAt: new Date().toISOString(),
    reopenReason: payload.reopenReason,
    createdAt: new Date().toISOString()
  });
  audit(role, "REOPEN_ERROR", error.errorId, before, { resolutionStatus: error.resolutionStatus, reason: payload.reopenReason }, request);
  return { meta: { timestamp: new Date().toISOString() }, ok: true, message: `Reopened ${error.errorId}.`, affected: [error.errorId] };
}

export function escalateError(errorId: string, payload: EscalateRequest, role: Mt5Role, request?: Request): ActionResponse {
  authorize(role, "escalate");
  const error = findError(errorId);
  const existing = state.incidents.find((i) => i.errorId === error.errorId && i.escalationStatus !== "Resolved");
  if (existing) {
    audit(role, "ESCALATE_EXISTING", existing.incidentId, null, { requiredAction: payload.requiredAction }, request);
    return { meta: { timestamp: new Date().toISOString() }, ok: true, message: `Escalation already open for ${error.errorId}.`, affected: [existing.incidentId] };
  }
  const minutesUnresolved = Math.max(0, Math.floor((Date.now() - new Date(error.firstSeenAt).getTime()) / 60_000));
  const decision = escalationDecision({
    severity: error.severity,
    unsafeTrading: error.statusAfter === "Unsafe" || error.errorType === "Unsafe Trading Condition",
    repeatCount: error.repeatCount,
    affectedAccounts: error.brokerId ? 4 : 10,
    brokerWide: Boolean(error.brokerId && error.repeatCount >= 6),
    autoRemediationFailed: false,
    minutesUnresolved
  });
  const assignedRole = payload.assignedRole ?? decision.assignedRole;
  const inc = {
    ...incidentFrom(error, assignedRole, payload.requiredAction),
    escalationStatus: "Open" as const
  };
  state.incidents.unshift(inc);
  audit(role, "ESCALATE", inc.incidentId, null, { errorId: error.errorId, requiredAction: payload.requiredAction, assignedRole }, request);
  return { meta: { timestamp: new Date().toISOString() }, ok: true, message: `Escalated ${error.errorId}.`, affected: [inc.incidentId] };
}

export function diagnostics(role: Mt5Role, errorId: string | null, request?: Request): ActionResponse {
  authorize(role, "diagnostics");
  const targets = errorId ? [findError(errorId)] : state.errors.filter((e) => e.severity === "Emergency" || e.severity === "Critical").slice(0, 5);
  for (const t of targets) {
    const diag = proposeDiagnostic(t);
    state.diagnostics.unshift(diag);
    audit(role, "RUN_DIAGNOSTICS", t.errorId, null, { diagId: diag.id }, request);
  }
  return { meta: { timestamp: new Date().toISOString() }, ok: true, message: "Diagnostics generated.", affected: targets.map((t) => t.errorId) };
}

export function autoRemediate(role: Mt5Role, errorId: string, request?: Request): ActionResponse {
  authorize(role, "remediate");
  const error = findError(errorId);
  const before = { resolutionStatus: error.resolutionStatus, statusAfter: error.statusAfter };
  error.resolutionStatus = "Resolved";
  error.statusAfter = "Recovered";
  error.updatedAt = new Date().toISOString();
  error.riskLevel = riskLevelFromSeverity(error.severity, error.resolutionStatus, error.repeatCount);
  state.resolutions.unshift({
    id: `res-${Date.now()}-${state.resolutions.length}`,
    errorId: error.errorId,
    resolutionAction: "Auto-remediation",
    resolutionNote: "Auto-remediation succeeded; diagnostics confirm recovery stability window.",
    resolvedBy: request?.headers.get("x-user-id") ?? role.toLowerCase().replace(/\s+/g, "-"),
    resolvedAt: new Date().toISOString(),
    reopenedBy: null,
    reopenedAt: null,
    reopenReason: null,
    createdAt: new Date().toISOString()
  });
  audit(role, "AUTO_REMEDIATE", error.errorId, before, { resolutionStatus: error.resolutionStatus, statusAfter: error.statusAfter }, request);
  return { meta: { timestamp: new Date().toISOString() }, ok: true, message: `Auto-remediation completed for ${error.errorId}.`, affected: [error.errorId] };
}

function toCsv(errors: Mt5ErrorLog[]) {
  if (!errors.length) return "";
  const headers = [
    "errorId",
    "occurredAt",
    "sourceModule",
    "errorType",
    "severity",
    "broker",
    "account",
    "terminal",
    "eaInstance",
    "symbol",
    "orderId",
    "mt5Ticket",
    "errorCode",
    "errorMessage",
    "repeatCount",
    "firstSeenAt",
    "lastSeenAt",
    "resolutionStatus",
    "assignedTo",
    "riskLevel"
  ];
  const escape = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  return [headers.join(","), ...errors.map((e) => headers.map((h) => escape((e as any)[h])).join(","))].join("\n");
}

export function exportReport(payload: ExportRequest, role: Mt5Role, request?: Request): ActionResponse {
  authorize(role, "export");
  const before = { lastExportAt: null };
  const filtered = listErrors({
    search: payload.filters?.search,
    severity: payload.filters?.severity && payload.filters.severity !== "all" ? payload.filters.severity : undefined,
    module: payload.filters?.module && payload.filters.module !== "all" ? payload.filters.module : undefined,
    status: payload.filters?.status && payload.filters.status !== "all" ? payload.filters.status : undefined,
    brokerId: payload.filters?.brokerId && payload.filters.brokerId !== "all" ? payload.filters.brokerId : undefined,
    page: 1,
    pageSize: 5000
  }).errors;
  const message = payload.format === "csv" ? toCsv(filtered) : JSON.stringify({ generatedAt: new Date().toISOString(), total: filtered.length, errors: filtered }, null, 2);
  audit(role, "EXPORT_REPORT", "EXPORT", before, { format: payload.format, total: filtered.length }, request);
  return { meta: { timestamp: new Date().toISOString() }, ok: true, message };
}

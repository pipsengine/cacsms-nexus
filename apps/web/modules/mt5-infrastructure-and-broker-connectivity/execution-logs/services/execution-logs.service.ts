import { createExecutionLogsSeed } from "../data/execution-logs.mock";
import type {
  ActionResponse,
  AiDiagnosticsResponse,
  AuditResponse,
  BrokerResponseResponse,
  ExceptionsResponse,
  ExecutionLogResponse,
  ExecutionLogsResponse,
  ExecutionLogsSummaryResponse,
  ExportRequest,
  MarkReviewedRequest,
  QualityAnalyticsResponse,
  RetryCancellationResponse,
  WorkflowResponse
} from "../types/execution-logs.types";
import { useExecutionLogsStore } from "../stores/execution-logs.store";
import { toCsv } from "../algorithms/execution-logs.algorithms";

const BASE = "/api/mt5/execution-logs";

function nowIso() {
  return new Date().toISOString();
}

function mockOnly() {
  return typeof window !== "undefined" && window.location.search.includes("mock=1");
}

function roleHeaders(extra?: HeadersInit): HeadersInit {
  const role = useExecutionLogsStore.getState().role;
  return { "x-mt5-role": role, ...(extra ?? {}) };
}

type MockState = ReturnType<typeof createExecutionLogsSeed>;
let mockState: MockState | null = null;
function ensureMockState(): MockState {
  if (mockState) return mockState;
  mockState = createExecutionLogsSeed();
  return mockState;
}

function paged<T>(rows: T[], page = 1, pageSize = 75) {
  const start = (page - 1) * pageSize;
  return rows.slice(start, start + pageSize);
}

function applyFilters(logs: MockState["logs"], params?: { search?: string; status?: string; brokerId?: string; symbol?: string; reviewed?: string }) {
  const search = params?.search?.trim().toLowerCase() ?? "";
  const status = params?.status ?? "all";
  const brokerId = params?.brokerId ?? "all";
  const symbol = params?.symbol ?? "all";
  const reviewed = params?.reviewed ?? "all";

  return logs.filter((l) => {
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

    const matchesStatus = status === "all" ? true : l.executionStatus === status;
    const matchesBroker = brokerId === "all" ? true : l.brokerId === brokerId;
    const matchesSymbol = symbol === "all" ? true : l.normalizedSymbol === symbol;
    const matchesReviewed = reviewed === "all" ? true : l.reviewedStatus === reviewed;
    return matchesSearch && matchesStatus && matchesBroker && matchesSymbol && matchesReviewed;
  });
}

export async function fetchExecutionLogsSummary() {
  if (mockOnly()) {
    const state = ensureMockState();
    const total = state.logs.length;
    const successful = state.logs.filter((l) => l.executionStatus === "Executed" || l.executionStatus === "Synced").length;
    const failed = state.logs.filter((l) => l.executionStatus === "Failed" || l.executionStatus === "Timed Out" || l.executionStatus === "Missing Feedback").length;
    const rejected = state.logs.filter((l) => l.executionStatus === "Rejected").length;
    const retried = state.logs.filter((l) => l.retryCount > 0).length;
    const cancelled = state.logs.filter((l) => l.executionStatus === "Cancelled").length;
    const pending = state.logs.filter((l) => l.executionStatus === "Pending" || l.executionStatus === "Sent" || l.executionStatus === "Delivered").length;
    const avgMs = Math.round(state.logs.reduce((sum, l) => sum + (l.executionTimeMs ?? 0), 0) / Math.max(1, state.logs.filter((l) => l.executionTimeMs != null).length));
    const avgSlip = Math.round(state.logs.reduce((sum, l) => sum + (l.slippagePoints ?? 0), 0) / Math.max(1, state.logs.filter((l) => l.slippagePoints != null).length));
    const requotes = state.logs.filter((l) => l.executionStatus === "Requoted").length;
    const highest = state.logs.find((l) => l.riskLevel === "Critical") ?? state.logs[0];
    const quality = state.qualityScore;

    const status = (value: number, warn: number, crit: number) => (value >= crit ? "Critical" : value >= warn ? "Degraded" : "Healthy");

    return {
      meta: { timestamp: nowIso(), currentRole: useExecutionLogsStore.getState().role, streamEndpoint: "/api/mt5/execution-logs/events-stream" },
      kpis: [
        { label: "Total Execution Events", value: String(total), status: "Healthy", detail: "All execution events in current window.", updatedAt: nowIso() },
        { label: "Successful Executions", value: String(successful), status: status(successful, 0, 0), detail: "Executed or synced successfully.", updatedAt: nowIso() },
        { label: "Failed Executions", value: String(failed), status: status(failed, 10, 20), detail: "Failed, timed out, or missing feedback.", updatedAt: nowIso() },
        { label: "Rejected Executions", value: String(rejected), status: status(rejected, 10, 20), detail: "Rejected by broker response.", updatedAt: nowIso() },
        { label: "Retried Executions", value: String(retried), status: status(retried, 12, 24), detail: "Executions that had retries.", updatedAt: nowIso() },
        { label: "Cancelled Executions", value: String(cancelled), status: status(cancelled, 8, 15), detail: "Cancelled by operator or gates.", updatedAt: nowIso() },
        { label: "Pending Confirmations", value: String(pending), status: status(pending, 15, 30), detail: "Awaiting ticket/feedback/fill confirmation.", updatedAt: nowIso() },
        { label: "Average Execution Time", value: `${avgMs}ms`, status: avgMs >= 2000 ? "Degraded" : avgMs >= 1200 ? "Watch" : "Healthy", detail: "Average execution time for completed feedback.", updatedAt: nowIso() },
        { label: "Average Slippage", value: `${avgSlip} pts`, status: Math.abs(avgSlip) >= 18 ? "Degraded" : Math.abs(avgSlip) >= 10 ? "Watch" : "Healthy", detail: "Direction-adjusted slippage magnitude.", updatedAt: nowIso() },
        { label: "Requote Count", value: String(requotes), status: status(requotes, 10, 18), detail: "Requotes / price changed patterns.", updatedAt: nowIso() },
        { label: "Highest Risk Execution", value: highest?.executionId ?? "—", status: highest?.riskLevel === "Critical" ? "Critical" : highest?.riskLevel === "High" ? "Degraded" : "Watch", detail: highest?.brokerResponseMessage ?? highest?.executionStatus ?? "—", updatedAt: nowIso() },
        { label: "Execution Quality Score", value: `${quality.score}/100`, status: quality.rating === "Critical" ? "Critical" : quality.rating === "High Risk" ? "Degraded" : quality.rating === "Degraded" ? "Watch" : "Healthy", detail: "Composite score across speed, slippage, rejections, feedback, and retries.", updatedAt: nowIso() }
      ],
      executionQualityScore: quality
    } satisfies ExecutionLogsSummaryResponse;
  }
  const res = await fetch(`${BASE}/summary`, { cache: "no-store", headers: roleHeaders() });
  if (!res.ok) throw new Error(`summary ${res.status}`);
  return (await res.json()) as ExecutionLogsSummaryResponse;
}

export async function fetchWorkflow() {
  if (mockOnly()) {
    const state = ensureMockState();
    return { meta: { timestamp: nowIso() }, workflow: state.workflow } satisfies WorkflowResponse;
  }
  const res = await fetch(`${BASE}/workflow`, { cache: "no-store", headers: roleHeaders() });
  if (!res.ok) throw new Error(`workflow ${res.status}`);
  return (await res.json()) as WorkflowResponse;
}

export async function fetchExecutionLogs(params?: { search?: string; status?: string; brokerId?: string; symbol?: string; reviewed?: string; page?: number; pageSize?: number }) {
  if (mockOnly()) {
    const state = ensureMockState();
    const page = params?.page ?? 1;
    const pageSize = params?.pageSize ?? 75;
    const filtered = applyFilters(state.logs, params);
    const sorted = [...filtered].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
    return { meta: { timestamp: nowIso(), total: filtered.length, page, pageSize }, logs: paged(sorted, page, pageSize) } satisfies ExecutionLogsResponse;
  }
  const url = new URL(`${BASE}`, typeof window !== "undefined" ? window.location.origin : "http://localhost");
  if (params?.search) url.searchParams.set("search", params.search);
  if (params?.status) url.searchParams.set("status", params.status);
  if (params?.brokerId) url.searchParams.set("brokerId", params.brokerId);
  if (params?.symbol) url.searchParams.set("symbol", params.symbol);
  if (params?.reviewed) url.searchParams.set("reviewed", params.reviewed);
  if (params?.page) url.searchParams.set("page", String(params.page));
  if (params?.pageSize) url.searchParams.set("pageSize", String(params.pageSize));
  const res = await fetch(url.toString(), { cache: "no-store", headers: roleHeaders() });
  if (!res.ok) throw new Error(`execution-logs ${res.status}`);
  return (await res.json()) as ExecutionLogsResponse;
}

export async function fetchExecutionLog(logId: string) {
  if (mockOnly()) {
    const state = ensureMockState();
    const log = state.logs.find((l) => l.logId === logId || l.id === logId || l.logId === decodeURIComponent(logId));
    if (!log) throw new Error("Log not found.");
    return { meta: { timestamp: nowIso() }, log } satisfies ExecutionLogResponse;
  }
  const res = await fetch(`${BASE}/${encodeURIComponent(logId)}`, { cache: "no-store", headers: roleHeaders() });
  if (!res.ok) throw new Error(`log ${res.status}`);
  return (await res.json()) as ExecutionLogResponse;
}

export async function fetchBrokerResponse(logId: string) {
  if (mockOnly()) {
    const state = ensureMockState();
    const log = state.logs.find((l) => l.logId === logId || l.id === logId);
    const resp = state.brokerResponses.find((r) => r.executionLogId === (log?.id ?? logId));
    if (!resp) throw new Error("Broker response not found.");
    return { meta: { timestamp: nowIso() }, brokerResponse: resp } satisfies BrokerResponseResponse;
  }
  const res = await fetch(`${BASE}/${encodeURIComponent(logId)}/broker-response`, { cache: "no-store", headers: roleHeaders() });
  if (!res.ok) throw new Error(`broker-response ${res.status}`);
  return (await res.json()) as BrokerResponseResponse;
}

export async function fetchRetryCancellation(logId: string) {
  if (mockOnly()) {
    const state = ensureMockState();
    const log = state.logs.find((l) => l.logId === logId || l.id === logId);
    const rc = state.retries.find((r) => r.originalExecutionId === log?.executionId) ?? state.retries[0];
    if (!rc) throw new Error("Retry/cancellation not found.");
    return { meta: { timestamp: nowIso() }, retryCancellation: rc } satisfies RetryCancellationResponse;
  }
  const res = await fetch(`${BASE}/${encodeURIComponent(logId)}/retry-cancellation`, { cache: "no-store", headers: roleHeaders() });
  if (!res.ok) throw new Error(`retry-cancellation ${res.status}`);
  return (await res.json()) as RetryCancellationResponse;
}

export async function fetchQualityAnalytics() {
  if (mockOnly()) {
    const state = ensureMockState();
    return { meta: { timestamp: nowIso(), total: state.qualityMetrics.length }, metrics: state.qualityMetrics } satisfies QualityAnalyticsResponse;
  }
  const res = await fetch(`${BASE}/quality-analytics`, { cache: "no-store", headers: roleHeaders() });
  if (!res.ok) throw new Error(`quality-analytics ${res.status}`);
  return (await res.json()) as QualityAnalyticsResponse;
}

export async function fetchExceptions(filter?: string) {
  if (mockOnly()) {
    const state = ensureMockState();
    const f = filter?.trim().toLowerCase() ?? "";
    const rows = f ? state.exceptions.filter((e) => [e.exceptionType, e.severity, e.resolutionStatus, e.broker, e.account, e.symbol].join(" ").toLowerCase().includes(f)) : state.exceptions;
    return { meta: { timestamp: nowIso(), total: rows.length }, exceptions: rows } satisfies ExceptionsResponse;
  }
  const url = new URL(`${BASE}/exceptions`, typeof window !== "undefined" ? window.location.origin : "http://localhost");
  if (filter) url.searchParams.set("filter", filter);
  const res = await fetch(url.toString(), { cache: "no-store", headers: roleHeaders() });
  if (!res.ok) throw new Error(`exceptions ${res.status}`);
  return (await res.json()) as ExceptionsResponse;
}

export async function fetchAiDiagnostics() {
  if (mockOnly()) {
    const state = ensureMockState();
    return { meta: { timestamp: nowIso(), total: state.diagnostics.length }, diagnostics: state.diagnostics } satisfies AiDiagnosticsResponse;
  }
  const res = await fetch(`${BASE}/ai-diagnostics`, { cache: "no-store", headers: roleHeaders() });
  if (!res.ok) throw new Error(`ai-diagnostics ${res.status}`);
  return (await res.json()) as AiDiagnosticsResponse;
}

export async function fetchAuditTrail() {
  if (mockOnly()) {
    const state = ensureMockState();
    return { meta: { timestamp: nowIso(), total: state.audit.length }, audit: state.audit } satisfies AuditResponse;
  }
  const res = await fetch(`${BASE}/audit`, { cache: "no-store", headers: roleHeaders() });
  if (!res.ok) throw new Error(`audit ${res.status}`);
  return (await res.json()) as AuditResponse;
}

export async function syncLatestExecutions() {
  const res = await fetch(`${BASE}/sync`, { method: "POST", headers: roleHeaders() });
  if (!res.ok) throw new Error(`sync ${res.status}`);
  return (await res.json()) as ActionResponse;
}

export async function markReviewed(logId: string, payload: MarkReviewedRequest) {
  const res = await fetch(`${BASE}/${encodeURIComponent(logId)}/mark-reviewed`, { method: "POST", headers: roleHeaders({ "content-type": "application/json" }), body: JSON.stringify(payload) });
  if (!res.ok) throw new Error(`mark-reviewed ${res.status}`);
  return (await res.json()) as ActionResponse;
}

export async function escalate(logId: string, payload: { requiredAction: string }) {
  const res = await fetch(`${BASE}/${encodeURIComponent(logId)}/escalate`, { method: "POST", headers: roleHeaders({ "content-type": "application/json" }), body: JSON.stringify(payload) });
  if (!res.ok) throw new Error(`escalate ${res.status}`);
  return (await res.json()) as ActionResponse;
}

export async function runDiagnostics(logId?: string) {
  const url = logId ? `${BASE}/${encodeURIComponent(logId)}/diagnostics` : `${BASE}/diagnostics`;
  const res = await fetch(url, { method: "POST", headers: roleHeaders({ "content-type": "application/json" }), body: JSON.stringify({}) });
  if (!res.ok) throw new Error(`diagnostics ${res.status}`);
  return (await res.json()) as ActionResponse;
}

export async function autoRemediate(payload: { logId: string }) {
  const res = await fetch(`${BASE}/auto-remediate`, { method: "POST", headers: roleHeaders({ "content-type": "application/json" }), body: JSON.stringify(payload) });
  if (!res.ok) throw new Error(`auto-remediate ${res.status}`);
  return (await res.json()) as ActionResponse;
}

export async function exportExecutionLogs(payload: ExportRequest) {
  if (mockOnly()) {
    const state = ensureMockState();
    const filtered = applyFilters(state.logs, payload.filters as any);
    const content = payload.format === "csv" ? toCsv(filtered) : JSON.stringify({ generatedAt: nowIso(), total: filtered.length, logs: filtered }, null, 2);
    return { meta: { timestamp: nowIso() }, ok: true, message: content } satisfies ActionResponse;
  }
  const res = await fetch(`${BASE}/export`, { method: "POST", headers: roleHeaders({ "content-type": "application/json" }), body: JSON.stringify(payload) });
  if (!res.ok) throw new Error(`export ${res.status}`);
  return (await res.json()) as ActionResponse;
}


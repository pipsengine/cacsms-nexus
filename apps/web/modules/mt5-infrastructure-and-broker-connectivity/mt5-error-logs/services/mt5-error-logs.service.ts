import { createMt5ErrorLogsSeed } from "../data/mt5-error-logs.mock";
import type {
  ActionResponse,
  AiDiagnosticsResponse,
  AuditResponse,
  CategoriesResponse,
  DiagnosticsRequest,
  ErrorLogResponse,
  ErrorLogsResponse,
  EscalateRequest,
  ExportRequest,
  IncidentsResponse,
  Mt5ErrorLog,
  ReopenRequest,
  RepeatedResponse,
  ResolveRequest,
  ResolutionsResponse,
  TrendsResponse,
  WorkflowResponse,
  Mt5ErrorLogsSummaryResponse
} from "../types/mt5-error-logs.types";
import { useMt5ErrorLogsStore } from "../stores/mt5-error-logs.store";
import { proposeDiagnostic } from "../algorithms/mt5-error-logs.algorithms";

const BASE = "/api/mt5/error-logs";

function nowIso() {
  return new Date().toISOString();
}

function mockOnly() {
  return typeof window !== "undefined" && window.location.search.includes("mock=1");
}

function roleHeaders(extra?: HeadersInit): HeadersInit {
  const role = useMt5ErrorLogsStore.getState().role;
  return { "x-mt5-role": role, ...(extra ?? {}) };
}

type MockState = ReturnType<typeof createMt5ErrorLogsSeed>;
let mockState: MockState | null = null;
function ensureMockState(): MockState {
  if (mockState) return mockState;
  mockState = createMt5ErrorLogsSeed();
  return mockState;
}

function paged<T>(rows: T[], page = 1, pageSize = 75) {
  const start = (page - 1) * pageSize;
  return rows.slice(start, start + pageSize);
}

function applyFilters(errors: Mt5ErrorLog[], params?: { search?: string; severity?: string; module?: string; status?: string; brokerId?: string }) {
  const search = params?.search?.trim().toLowerCase() ?? "";
  const sev = params?.severity ?? "all";
  const mod = params?.module ?? "all";
  const status = params?.status ?? "all";
  const brokerId = params?.brokerId ?? "all";

  return errors.filter((e) => {
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

    const matchesSeverity = sev === "all" ? true : e.severity === sev;
    const matchesModule = mod === "all" ? true : e.sourceModule === mod;
    const matchesStatus = status === "all" ? true : e.resolutionStatus === status;
    const matchesBroker = brokerId === "all" ? true : e.brokerId === brokerId;
    return matchesSearch && matchesSeverity && matchesModule && matchesStatus && matchesBroker;
  });
}

export async function fetchErrorLogsSummary() {
  if (mockOnly()) {
    const state = ensureMockState();
    return {
      meta: { timestamp: nowIso(), currentRole: useMt5ErrorLogsStore.getState().role, streamEndpoint: "/api/mt5/error-logs/events-stream" },
      kpis: state.kpis,
      aiRiskScore: state.aiRiskScore
    } satisfies Mt5ErrorLogsSummaryResponse;
  }
  const res = await fetch(`${BASE}/summary`, { cache: "no-store", headers: roleHeaders() });
  if (!res.ok) throw new Error(`summary ${res.status}`);
  return (await res.json()) as Mt5ErrorLogsSummaryResponse;
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

export async function fetchErrorLogs(params?: { search?: string; severity?: string; module?: string; status?: string; brokerId?: string; page?: number; pageSize?: number }) {
  if (mockOnly()) {
    const state = ensureMockState();
    const page = params?.page ?? 1;
    const pageSize = params?.pageSize ?? 75;
    const filtered = applyFilters(state.errors, params);
    const sorted = [...filtered].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
    return { meta: { timestamp: nowIso(), total: filtered.length, page, pageSize }, errors: paged(sorted, page, pageSize) } satisfies ErrorLogsResponse;
  }
  const url = new URL(`${BASE}`, typeof window !== "undefined" ? window.location.origin : "http://localhost");
  if (params?.search) url.searchParams.set("search", params.search);
  if (params?.severity) url.searchParams.set("severity", params.severity);
  if (params?.module) url.searchParams.set("module", params.module);
  if (params?.status) url.searchParams.set("status", params.status);
  if (params?.brokerId) url.searchParams.set("brokerId", params.brokerId);
  if (params?.page) url.searchParams.set("page", String(params.page));
  if (params?.pageSize) url.searchParams.set("pageSize", String(params.pageSize));
  const res = await fetch(url.toString(), { cache: "no-store", headers: roleHeaders() });
  if (!res.ok) throw new Error(`error-logs ${res.status}`);
  return (await res.json()) as ErrorLogsResponse;
}

export async function fetchErrorLog(errorId: string) {
  if (mockOnly()) {
    const state = ensureMockState();
    const error = state.errors.find((e) => e.errorId === errorId || e.id === errorId);
    if (!error) throw new Error("Error not found.");
    return { meta: { timestamp: nowIso() }, error } satisfies ErrorLogResponse;
  }
  const res = await fetch(`${BASE}/${encodeURIComponent(errorId)}`, { cache: "no-store", headers: roleHeaders() });
  if (!res.ok) throw new Error(`error ${res.status}`);
  return (await res.json()) as ErrorLogResponse;
}

export async function syncLatestErrors() {
  const res = await fetch(`${BASE}/sync`, { method: "POST", headers: roleHeaders() });
  if (!res.ok) throw new Error(`sync ${res.status}`);
  return (await res.json()) as ActionResponse;
}

export async function resolveError(errorId: string, payload: ResolveRequest) {
  const res = await fetch(`${BASE}/${encodeURIComponent(errorId)}/resolve`, { method: "POST", headers: roleHeaders({ "content-type": "application/json" }), body: JSON.stringify(payload) });
  if (!res.ok) throw new Error(`resolve ${res.status}`);
  return (await res.json()) as ActionResponse;
}

export async function reopenError(errorId: string, payload: ReopenRequest) {
  const res = await fetch(`${BASE}/${encodeURIComponent(errorId)}/reopen`, { method: "POST", headers: roleHeaders({ "content-type": "application/json" }), body: JSON.stringify(payload) });
  if (!res.ok) throw new Error(`reopen ${res.status}`);
  return (await res.json()) as ActionResponse;
}

export async function escalateError(errorId: string, payload: EscalateRequest) {
  const res = await fetch(`${BASE}/${encodeURIComponent(errorId)}/escalate`, { method: "POST", headers: roleHeaders({ "content-type": "application/json" }), body: JSON.stringify(payload) });
  if (!res.ok) throw new Error(`escalate ${res.status}`);
  return (await res.json()) as ActionResponse;
}

export async function runErrorDiagnostics(errorId?: string, payload?: DiagnosticsRequest) {
  const url = errorId ? `${BASE}/${encodeURIComponent(errorId)}/diagnostics` : `${BASE}/diagnostics`;
  const res = await fetch(url, { method: "POST", headers: roleHeaders({ "content-type": "application/json" }), body: JSON.stringify(payload ?? {}) });
  if (!res.ok) throw new Error(`diagnostics ${res.status}`);
  return (await res.json()) as ActionResponse;
}

export async function fetchCategories() {
  if (mockOnly()) {
    const state = ensureMockState();
    return { meta: { timestamp: nowIso(), total: state.categories.length }, categories: state.categories } satisfies CategoriesResponse;
  }
  const res = await fetch(`${BASE}/categories`, { cache: "no-store", headers: roleHeaders() });
  if (!res.ok) throw new Error(`categories ${res.status}`);
  return (await res.json()) as CategoriesResponse;
}

export async function fetchTrends() {
  if (mockOnly()) {
    const state = ensureMockState();
    return { meta: { timestamp: nowIso(), total: state.trends.length }, points: state.trends } satisfies TrendsResponse;
  }
  const res = await fetch(`${BASE}/trends`, { cache: "no-store", headers: roleHeaders() });
  if (!res.ok) throw new Error(`trends ${res.status}`);
  return (await res.json()) as TrendsResponse;
}

export async function fetchRepeated() {
  if (mockOnly()) {
    const state = ensureMockState();
    return { meta: { timestamp: nowIso(), total: state.fingerprints.length }, fingerprints: state.fingerprints } satisfies RepeatedResponse;
  }
  const res = await fetch(`${BASE}/repeated`, { cache: "no-store", headers: roleHeaders() });
  if (!res.ok) throw new Error(`repeated ${res.status}`);
  return (await res.json()) as RepeatedResponse;
}

export async function fetchIncidents() {
  if (mockOnly()) {
    const state = ensureMockState();
    return { meta: { timestamp: nowIso(), total: state.incidents.length }, incidents: state.incidents } satisfies IncidentsResponse;
  }
  const res = await fetch(`${BASE}/incidents`, { cache: "no-store", headers: roleHeaders() });
  if (!res.ok) throw new Error(`incidents ${res.status}`);
  return (await res.json()) as IncidentsResponse;
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

export async function autoRemediate(payload: { errorId: string }) {
  const res = await fetch(`${BASE}/auto-remediate`, { method: "POST", headers: roleHeaders({ "content-type": "application/json" }), body: JSON.stringify(payload) });
  if (!res.ok) throw new Error(`auto-remediate ${res.status}`);
  return (await res.json()) as ActionResponse;
}

export async function exportErrorReport(payload: ExportRequest) {
  if (mockOnly()) {
    const state = ensureMockState();
    const filtered = applyFilters(state.errors, payload.filters);
    const withDiagnostics = filtered.slice(0, 30).map((e) => ({ ...e, ai: proposeDiagnostic(e) }));
    const asJson = JSON.stringify({ generatedAt: nowIso(), total: filtered.length, errors: withDiagnostics }, null, 2);
    if (payload.format === "json") {
      return { meta: { timestamp: nowIso() }, ok: true, message: asJson } satisfies ActionResponse;
    }
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
    const escape = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = [headers.join(","), ...filtered.map((e) => headers.map((h) => escape((e as any)[h])).join(","))].join("\n");
    return { meta: { timestamp: nowIso() }, ok: true, message: csv } satisfies ActionResponse;
  }

  const res = await fetch(`${BASE}/export`, { method: "POST", headers: roleHeaders({ "content-type": "application/json" }), body: JSON.stringify(payload) });
  if (!res.ok) throw new Error(`export ${res.status}`);
  return (await res.json()) as ActionResponse;
}

export async function fetchResolutions() {
  if (mockOnly()) {
    const state = ensureMockState();
    return { meta: { timestamp: nowIso(), total: state.resolutions.length }, resolutions: state.resolutions } satisfies ResolutionsResponse;
  }
  const res = await fetch(`${BASE}/resolutions`, { cache: "no-store", headers: roleHeaders() });
  if (!res.ok) throw new Error(`resolutions ${res.status}`);
  return (await res.json()) as ResolutionsResponse;
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


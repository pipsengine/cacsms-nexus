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
  ReopenRequest,
  RepeatedResponse,
  ResolveRequest,
  ResolutionsResponse,
  TrendsResponse,
  WorkflowResponse,
  Mt5ErrorLogsSummaryResponse
} from "../types/mt5-error-logs.types";
import { useMt5ErrorLogsStore } from "../stores/mt5-error-logs.store";

const BASE = "/api/mt5/error-logs";

function roleHeaders(extra?: HeadersInit): HeadersInit {
  const role = useMt5ErrorLogsStore.getState().role;
  return { "x-mt5-role": role, ...(extra ?? {}) };
}

export async function fetchErrorLogsSummary() {

  const res = await fetch(`${BASE}/summary`, { cache: "no-store", headers: roleHeaders() });
  if (!res.ok) throw new Error(`summary ${res.status}`);
  return (await res.json()) as Mt5ErrorLogsSummaryResponse;
}

export async function fetchWorkflow() {

  const res = await fetch(`${BASE}/workflow`, { cache: "no-store", headers: roleHeaders() });
  if (!res.ok) throw new Error(`workflow ${res.status}`);
  return (await res.json()) as WorkflowResponse;
}

export async function fetchErrorLogs(params?: { search?: string; severity?: string; module?: string; status?: string; brokerId?: string; page?: number; pageSize?: number }) {

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

  const res = await fetch(`${BASE}/categories`, { cache: "no-store", headers: roleHeaders() });
  if (!res.ok) throw new Error(`categories ${res.status}`);
  return (await res.json()) as CategoriesResponse;
}

export async function fetchTrends() {

  const res = await fetch(`${BASE}/trends`, { cache: "no-store", headers: roleHeaders() });
  if (!res.ok) throw new Error(`trends ${res.status}`);
  return (await res.json()) as TrendsResponse;
}

export async function fetchRepeated() {

  const res = await fetch(`${BASE}/repeated`, { cache: "no-store", headers: roleHeaders() });
  if (!res.ok) throw new Error(`repeated ${res.status}`);
  return (await res.json()) as RepeatedResponse;
}

export async function fetchIncidents() {

  const res = await fetch(`${BASE}/incidents`, { cache: "no-store", headers: roleHeaders() });
  if (!res.ok) throw new Error(`incidents ${res.status}`);
  return (await res.json()) as IncidentsResponse;
}

export async function fetchAiDiagnostics() {

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


  const res = await fetch(`${BASE}/export`, { method: "POST", headers: roleHeaders({ "content-type": "application/json" }), body: JSON.stringify(payload) });
  if (!res.ok) throw new Error(`export ${res.status}`);
  return (await res.json()) as ActionResponse;
}

export async function fetchResolutions() {

  const res = await fetch(`${BASE}/resolutions`, { cache: "no-store", headers: roleHeaders() });
  if (!res.ok) throw new Error(`resolutions ${res.status}`);
  return (await res.json()) as ResolutionsResponse;
}

export async function fetchAuditTrail() {

  const res = await fetch(`${BASE}/audit`, { cache: "no-store", headers: roleHeaders() });
  if (!res.ok) throw new Error(`audit ${res.status}`);
  return (await res.json()) as AuditResponse;
}


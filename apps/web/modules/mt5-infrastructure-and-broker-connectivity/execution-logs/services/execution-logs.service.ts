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

const BASE = "/api/mt5/execution-logs";

function roleHeaders(extra?: HeadersInit): HeadersInit {
  const role = useExecutionLogsStore.getState().role;
  return { "x-mt5-role": role, ...(extra ?? {}) };
}

export async function fetchExecutionLogsSummary() {
  const res = await fetch(`${BASE}/summary`, { cache: "no-store", headers: roleHeaders() });
  if (!res.ok) throw new Error(`summary ${res.status}`);
  return (await res.json()) as ExecutionLogsSummaryResponse;
}

export async function fetchWorkflow() {
  const res = await fetch(`${BASE}/workflow`, { cache: "no-store", headers: roleHeaders() });
  if (!res.ok) throw new Error(`workflow ${res.status}`);
  return (await res.json()) as WorkflowResponse;
}

export async function fetchExecutionLogs(params?: { search?: string; status?: string; brokerId?: string; symbol?: string; reviewed?: string; page?: number; pageSize?: number }) {
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
  const res = await fetch(`${BASE}/${encodeURIComponent(logId)}`, { cache: "no-store", headers: roleHeaders() });
  if (!res.ok) throw new Error(`log ${res.status}`);
  return (await res.json()) as ExecutionLogResponse;
}

export async function fetchBrokerResponse(logId: string) {
  const res = await fetch(`${BASE}/${encodeURIComponent(logId)}/broker-response`, { cache: "no-store", headers: roleHeaders() });
  if (!res.ok) throw new Error(`broker-response ${res.status}`);
  return (await res.json()) as BrokerResponseResponse;
}

export async function fetchRetryCancellation(logId: string) {
  const res = await fetch(`${BASE}/${encodeURIComponent(logId)}/retry-cancellation`, { cache: "no-store", headers: roleHeaders() });
  if (!res.ok) throw new Error(`retry-cancellation ${res.status}`);
  return (await res.json()) as RetryCancellationResponse;
}

export async function fetchQualityAnalytics() {
  const res = await fetch(`${BASE}/quality-analytics`, { cache: "no-store", headers: roleHeaders() });
  if (!res.ok) throw new Error(`quality-analytics ${res.status}`);
  return (await res.json()) as QualityAnalyticsResponse;
}

export async function fetchExceptions(filter?: string) {
  const url = new URL(`${BASE}/exceptions`, typeof window !== "undefined" ? window.location.origin : "http://localhost");
  if (filter) url.searchParams.set("filter", filter);
  const res = await fetch(url.toString(), { cache: "no-store", headers: roleHeaders() });
  if (!res.ok) throw new Error(`exceptions ${res.status}`);
  return (await res.json()) as ExceptionsResponse;
}

export async function fetchAiDiagnostics() {
  const res = await fetch(`${BASE}/ai-diagnostics`, { cache: "no-store", headers: roleHeaders() });
  if (!res.ok) throw new Error(`ai-diagnostics ${res.status}`);
  return (await res.json()) as AiDiagnosticsResponse;
}

export async function fetchAuditTrail() {
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
  const res = await fetch(`${BASE}/export`, { method: "POST", headers: roleHeaders({ "content-type": "application/json" }), body: JSON.stringify(payload) });
  if (!res.ok) throw new Error(`export ${res.status}`);
  return (await res.json()) as ActionResponse;
}

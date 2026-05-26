import type {
  ActionResponse,
  AiDiagnosticsResponse,
  AnalyticsResponse,
  AuditResponse,
  CommandsResponse,
  EaMonitoringSummaryResponse,
  ExceptionsResponse,
  ExportRequest,
  InstanceResponse,
  InstancesResponse,
  LogsResponse,
  RebindStrategyRequest,
  RebindTerminalRequest,
  StrategyBindingsResponse,
  WorkflowResponse
} from "../types/ea-monitoring.types";
import { useEaMonitoringStore } from "../stores/ea-monitoring.store";

const BASE = "/api/mt5/ea-monitoring";

function roleHeaders(extra?: HeadersInit): HeadersInit {
  const role = useEaMonitoringStore.getState().role;
  return { "x-mt5-role": role, ...(extra ?? {}) };
}

export async function fetchEaSummary() {
  const res = await fetch(`${BASE}/summary`, { cache: "no-store", headers: roleHeaders() });
  if (!res.ok) throw new Error(`summary ${res.status}`);
  return (await res.json()) as EaMonitoringSummaryResponse;
}

export async function fetchWorkflow() {
  const res = await fetch(`${BASE}/workflow`, { cache: "no-store", headers: roleHeaders() });
  if (!res.ok) throw new Error(`workflow ${res.status}`);
  return (await res.json()) as WorkflowResponse;
}

export async function fetchInstances(params?: { search?: string; status?: string; risk?: string; trading?: string; page?: number; pageSize?: number }) {
  const url = new URL(`${BASE}/instances`, typeof window !== "undefined" ? window.location.origin : "http://localhost");
  if (params?.search) url.searchParams.set("search", params.search);
  if (params?.status) url.searchParams.set("status", params.status);
  if (params?.risk) url.searchParams.set("risk", params.risk);
  if (params?.trading) url.searchParams.set("trading", params.trading);
  if (params?.page) url.searchParams.set("page", String(params.page));
  if (params?.pageSize) url.searchParams.set("pageSize", String(params.pageSize));
  const res = await fetch(url.toString(), { cache: "no-store", headers: roleHeaders() });
  if (!res.ok) throw new Error(`instances ${res.status}`);
  return (await res.json()) as InstancesResponse;
}

export async function fetchInstance(eaId: string) {
  const res = await fetch(`${BASE}/instances/${encodeURIComponent(eaId)}`, { cache: "no-store", headers: roleHeaders() });
  if (!res.ok) throw new Error(`instance ${res.status}`);
  return (await res.json()) as InstanceResponse;
}

export async function fetchCommands(params?: { search?: string; page?: number; pageSize?: number }) {
  const url = new URL(`${BASE}/commands`, typeof window !== "undefined" ? window.location.origin : "http://localhost");
  if (params?.search) url.searchParams.set("search", params.search);
  if (params?.page) url.searchParams.set("page", String(params.page));
  if (params?.pageSize) url.searchParams.set("pageSize", String(params.pageSize));
  const res = await fetch(url.toString(), { cache: "no-store", headers: roleHeaders() });
  if (!res.ok) throw new Error(`commands ${res.status}`);
  return (await res.json()) as CommandsResponse;
}

export async function fetchStrategyBindings() {
  const res = await fetch(`${BASE}/strategy-bindings`, { cache: "no-store", headers: roleHeaders() });
  if (!res.ok) throw new Error(`strategy-bindings ${res.status}`);
  return (await res.json()) as StrategyBindingsResponse;
}

export async function fetchLogs(filter?: string) {
  const url = new URL(`${BASE}/logs`, typeof window !== "undefined" ? window.location.origin : "http://localhost");
  if (filter) url.searchParams.set("filter", filter);
  const res = await fetch(url.toString(), { cache: "no-store", headers: roleHeaders() });
  if (!res.ok) throw new Error(`logs ${res.status}`);
  return (await res.json()) as LogsResponse;
}

export async function fetchExceptions(filter?: string) {
  const url = new URL(`${BASE}/exceptions`, typeof window !== "undefined" ? window.location.origin : "http://localhost");
  if (filter) url.searchParams.set("filter", filter);
  const res = await fetch(url.toString(), { cache: "no-store", headers: roleHeaders() });
  if (!res.ok) throw new Error(`exceptions ${res.status}`);
  return (await res.json()) as ExceptionsResponse;
}

export async function fetchAnalytics() {
  const res = await fetch(`${BASE}/analytics`, { cache: "no-store", headers: roleHeaders() });
  if (!res.ok) throw new Error(`analytics ${res.status}`);
  return (await res.json()) as AnalyticsResponse;
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

export async function syncEaStatus() {
  const res = await fetch(`${BASE}/sync`, { method: "POST", headers: roleHeaders() });
  if (!res.ok) throw new Error(`sync ${res.status}`);
  return (await res.json()) as ActionResponse;
}

export async function runEaDiagnostics(eaId?: string) {
  const url = eaId ? `${BASE}/instances/${encodeURIComponent(eaId)}/diagnostics` : `${BASE}/diagnostics`;
  const res = await fetch(url, { method: "POST", headers: roleHeaders({ "content-type": "application/json" }), body: JSON.stringify({}) });
  if (!res.ok) throw new Error(`diagnostics ${res.status}`);
  return (await res.json()) as ActionResponse;
}

export async function restartEaSession(eaId: string) {
  const res = await fetch(`${BASE}/instances/${encodeURIComponent(eaId)}/restart`, { method: "POST", headers: roleHeaders() });
  if (!res.ok) throw new Error(`restart ${res.status}`);
  return (await res.json()) as ActionResponse;
}

export async function disableEaTrading(eaId: string) {
  const res = await fetch(`${BASE}/instances/${encodeURIComponent(eaId)}/disable-trading`, { method: "POST", headers: roleHeaders() });
  if (!res.ok) throw new Error(`disable ${res.status}`);
  return (await res.json()) as ActionResponse;
}

export async function enableEaTrading(eaId: string) {
  const res = await fetch(`${BASE}/instances/${encodeURIComponent(eaId)}/enable-trading`, { method: "POST", headers: roleHeaders() });
  if (!res.ok) throw new Error(`enable ${res.status}`);
  return (await res.json()) as ActionResponse;
}

export async function rebindStrategy(eaId: string, payload: RebindStrategyRequest) {
  const res = await fetch(`${BASE}/instances/${encodeURIComponent(eaId)}/rebind-strategy`, { method: "POST", headers: roleHeaders({ "content-type": "application/json" }), body: JSON.stringify(payload) });
  if (!res.ok) throw new Error(`rebind-strategy ${res.status}`);
  return (await res.json()) as ActionResponse;
}

export async function rebindTerminal(eaId: string, payload: RebindTerminalRequest) {
  const res = await fetch(`${BASE}/instances/${encodeURIComponent(eaId)}/rebind-terminal`, { method: "POST", headers: roleHeaders({ "content-type": "application/json" }), body: JSON.stringify(payload) });
  if (!res.ok) throw new Error(`rebind-terminal ${res.status}`);
  return (await res.json()) as ActionResponse;
}

export async function autoRemediate(payload: { eaId: string }) {
  const res = await fetch(`${BASE}/auto-remediate`, { method: "POST", headers: roleHeaders({ "content-type": "application/json" }), body: JSON.stringify(payload) });
  if (!res.ok) throw new Error(`auto-remediate ${res.status}`);
  return (await res.json()) as ActionResponse;
}

export async function exportEaReport(payload: ExportRequest) {
  const res = await fetch(`${BASE}/export`, { method: "POST", headers: roleHeaders({ "content-type": "application/json" }), body: JSON.stringify(payload) });
  if (!res.ok) throw new Error(`export ${res.status}`);
  return (await res.json()) as ActionResponse;
}

import type {
  ActionResponse,
  AiDiagnosticsResponse,
  AlertsResponse,
  BrokerComparisonResponse,
  LogsResponse,
  SpreadMonitorSummaryResponse,
  SpreadsResponse,
  SymbolSpreadResponse,
  ThresholdCreateRequest,
  ThresholdUpdateRequest,
  ThresholdsResponse,
  TrendsResponse
} from "../types/spread-monitor.types";
import { useSpreadMonitorStore } from "../stores/spread-monitor.store";

const BASE = "/api/mt5/spread-monitor";

function roleHeaders(extra?: HeadersInit): HeadersInit {
  const role = useSpreadMonitorStore.getState().role;
  return { "x-mt5-role": role, ...(extra ?? {}) };
}

export async function fetchSpreadSummary() {
  const res = await fetch(`${BASE}/summary`, { cache: "no-store", headers: roleHeaders() });
  if (!res.ok) throw new Error(`summary ${res.status}`);
  return (await res.json()) as SpreadMonitorSummaryResponse;
}

export async function fetchSpreads(params?: { search?: string; assetClass?: string; status?: string; brokerId?: string; page?: number; pageSize?: number }) {
  const url = new URL(`${BASE}/spreads`, typeof window !== "undefined" ? window.location.origin : "http://localhost");
  if (params?.search) url.searchParams.set("search", params.search);
  if (params?.assetClass) url.searchParams.set("assetClass", params.assetClass);
  if (params?.status) url.searchParams.set("status", params.status);
  if (params?.brokerId) url.searchParams.set("brokerId", params.brokerId);
  if (params?.page) url.searchParams.set("page", String(params.page));
  if (params?.pageSize) url.searchParams.set("pageSize", String(params.pageSize));
  const res = await fetch(url.toString(), { cache: "no-store", headers: roleHeaders() });
  if (!res.ok) throw new Error(`spreads ${res.status}`);
  return (await res.json()) as SpreadsResponse;
}

export async function fetchSymbolSpread(symbol: string) {
  const res = await fetch(`${BASE}/symbols/${encodeURIComponent(symbol)}`, { cache: "no-store", headers: roleHeaders() });
  if (!res.ok) throw new Error(`symbol ${res.status}`);
  return (await res.json()) as SymbolSpreadResponse;
}

export async function fetchBrokerComparison() {
  const res = await fetch(`${BASE}/broker-comparison`, { cache: "no-store", headers: roleHeaders() });
  if (!res.ok) throw new Error(`broker-comparison ${res.status}`);
  return (await res.json()) as BrokerComparisonResponse;
}

export async function fetchTrends() {
  const res = await fetch(`${BASE}/trends`, { cache: "no-store", headers: roleHeaders() });
  if (!res.ok) throw new Error(`trends ${res.status}`);
  return (await res.json()) as TrendsResponse;
}

export async function fetchThresholds() {
  const res = await fetch(`${BASE}/thresholds`, { cache: "no-store", headers: roleHeaders() });
  if (!res.ok) throw new Error(`thresholds ${res.status}`);
  return (await res.json()) as ThresholdsResponse;
}

export async function postThresholds(payload: ThresholdCreateRequest) {
  const res = await fetch(`${BASE}/thresholds`, { method: "POST", headers: roleHeaders({ "content-type": "application/json" }), body: JSON.stringify(payload) });
  if (!res.ok) throw new Error(`thresholds-post ${res.status}`);
  return (await res.json()) as ActionResponse;
}

export async function patchThreshold(thresholdId: string, patch: ThresholdUpdateRequest) {
  const res = await fetch(`${BASE}/thresholds/${thresholdId}`, {
    method: "PATCH",
    headers: roleHeaders({ "content-type": "application/json" }),
    body: JSON.stringify(patch)
  });
  if (!res.ok) throw new Error(`thresholds-patch ${res.status}`);
  return (await res.json()) as ActionResponse;
}

export async function disableExecution(symbol: string) {
  const res = await fetch(`${BASE}/symbols/${encodeURIComponent(symbol)}/disable-execution`, { method: "POST", headers: roleHeaders() });
  if (!res.ok) throw new Error(`disable-execution ${res.status}`);
  return (await res.json()) as ActionResponse;
}

export async function enableExecution(symbol: string) {
  const res = await fetch(`${BASE}/symbols/${encodeURIComponent(symbol)}/enable-execution`, { method: "POST", headers: roleHeaders() });
  if (!res.ok) throw new Error(`enable-execution ${res.status}`);
  return (await res.json()) as ActionResponse;
}

export async function runSpreadDiagnostics() {
  const res = await fetch(`${BASE}/diagnostics`, { method: "POST", headers: roleHeaders() });
  if (!res.ok) throw new Error(`diagnostics ${res.status}`);
  return (await res.json()) as ActionResponse;
}

export async function fetchAlerts(filter?: string) {
  const url = new URL(`${BASE}/alerts`, typeof window !== "undefined" ? window.location.origin : "http://localhost");
  if (filter) url.searchParams.set("filter", filter);
  const res = await fetch(url.toString(), { cache: "no-store", headers: roleHeaders() });
  if (!res.ok) throw new Error(`alerts ${res.status}`);
  return (await res.json()) as AlertsResponse;
}

export async function fetchLogs(filter?: string) {
  const url = new URL(`${BASE}/logs`, typeof window !== "undefined" ? window.location.origin : "http://localhost");
  if (filter) url.searchParams.set("filter", filter);
  const res = await fetch(url.toString(), { cache: "no-store", headers: roleHeaders() });
  if (!res.ok) throw new Error(`logs ${res.status}`);
  return (await res.json()) as LogsResponse;
}

export async function fetchAiDiagnostics() {
  const res = await fetch(`${BASE}/ai-diagnostics`, { cache: "no-store", headers: roleHeaders() });
  if (!res.ok) throw new Error(`ai-diagnostics ${res.status}`);
  return (await res.json()) as AiDiagnosticsResponse;
}

export async function autoRemediate() {
  const res = await fetch(`${BASE}/auto-remediate`, { method: "POST", headers: roleHeaders() });
  if (!res.ok) throw new Error(`auto-remediate ${res.status}`);
  return (await res.json()) as ActionResponse;
}

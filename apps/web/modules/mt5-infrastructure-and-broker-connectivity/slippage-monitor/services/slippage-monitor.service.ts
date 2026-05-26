import type {
  ActionResponse,
  AiDiagnosticsResponse,
  AlertsResponse,
  BrokerComparisonResponse,
  ExecutionResponse,
  ExecutionsResponse,
  LogsResponse,
  SlippageMonitorSummaryResponse,
  ThresholdCreateRequest,
  ThresholdUpdateRequest,
  ThresholdsResponse,
  TrendsResponse,
  WorkflowResponse
} from "../types/slippage-monitor.types";
import { useSlippageMonitorStore } from "../stores/slippage-monitor.store";

const BASE = "/api/mt5/slippage-monitor";

function roleHeaders(extra?: HeadersInit): HeadersInit {
  const role = useSlippageMonitorStore.getState().role;
  return { "x-mt5-role": role, ...(extra ?? {}) };
}

export async function fetchSlippageSummary() {

  const res = await fetch(`${BASE}/summary`, { cache: "no-store", headers: roleHeaders() });
  if (!res.ok) throw new Error(`summary ${res.status}`);
  return (await res.json()) as SlippageMonitorSummaryResponse;
}

export async function fetchWorkflow() {

  const res = await fetch(`${BASE}/workflow`, { cache: "no-store", headers: roleHeaders() });
  if (!res.ok) throw new Error(`workflow ${res.status}`);
  return (await res.json()) as WorkflowResponse;
}

export async function fetchExecutions(params?: { search?: string; assetClass?: string; breach?: string; brokerId?: string; page?: number; pageSize?: number }) {


  const url = new URL(`${BASE}/executions`, typeof window !== "undefined" ? window.location.origin : "http://localhost");
  if (params?.search) url.searchParams.set("search", params.search);
  if (params?.assetClass) url.searchParams.set("assetClass", params.assetClass);
  if (params?.breach) url.searchParams.set("breach", params.breach);
  if (params?.brokerId) url.searchParams.set("brokerId", params.brokerId);
  if (params?.page) url.searchParams.set("page", String(params.page));
  if (params?.pageSize) url.searchParams.set("pageSize", String(params.pageSize));
  const res = await fetch(url.toString(), { cache: "no-store", headers: roleHeaders() });
  if (!res.ok) throw new Error(`executions ${res.status}`);
  return (await res.json()) as ExecutionsResponse;
}

export async function fetchExecution(executionId: string) {

  const res = await fetch(`${BASE}/executions/${encodeURIComponent(executionId)}`, { cache: "no-store", headers: roleHeaders() });
  if (!res.ok) throw new Error(`execution ${res.status}`);
  return (await res.json()) as ExecutionResponse;
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

export async function postThreshold(payload: ThresholdCreateRequest) {
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

export async function runDiagnostics() {
  const res = await fetch(`${BASE}/diagnostics`, { method: "POST", headers: roleHeaders() });
  if (!res.ok) throw new Error(`diagnostics ${res.status}`);
  return (await res.json()) as ActionResponse;
}

export async function disableUnsafeExecution() {
  const res = await fetch(`${BASE}/disable-unsafe-execution`, { method: "POST", headers: roleHeaders() });
  if (!res.ok) throw new Error(`disable-unsafe-execution ${res.status}`);
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


import type {
  ActionResponse,
  AiDiagnosticsResponse,
  AlertsResponse,
  BrokerComparisonResponse,
  LatencyMonitorSummaryResponse,
  LogsResponse,
  MetricResponse,
  MetricsResponse,
  TestResponse,
  ThresholdCreateRequest,
  ThresholdUpdateRequest,
  ThresholdsResponse,
  TrendsResponse,
  WorkflowResponse
} from "../types/latency-monitor.types";
import { useLatencyMonitorStore } from "../stores/latency-monitor.store";

const BASE = "/api/mt5/latency-monitor";

function roleHeaders(extra?: HeadersInit): HeadersInit {
  const role = useLatencyMonitorStore.getState().role;
  return { "x-mt5-role": role, ...(extra ?? {}) };
}

export async function fetchLatencySummary() {

  const res = await fetch(`${BASE}/summary`, { cache: "no-store", headers: roleHeaders() });
  if (!res.ok) throw new Error(`summary ${res.status}`);
  return (await res.json()) as LatencyMonitorSummaryResponse;
}

export async function fetchWorkflow() {

  const res = await fetch(`${BASE}/workflow`, { cache: "no-store", headers: roleHeaders() });
  if (!res.ok) throw new Error(`workflow ${res.status}`);
  return (await res.json()) as WorkflowResponse;
}

export async function fetchMetrics(params?: { search?: string; componentType?: string; breach?: string; brokerId?: string; page?: number; pageSize?: number }) {


  const url = new URL(`${BASE}/metrics`, typeof window !== "undefined" ? window.location.origin : "http://localhost");
  if (params?.search) url.searchParams.set("search", params.search);
  if (params?.componentType) url.searchParams.set("componentType", params.componentType);
  if (params?.breach) url.searchParams.set("breach", params.breach);
  if (params?.brokerId) url.searchParams.set("brokerId", params.brokerId);
  if (params?.page) url.searchParams.set("page", String(params.page));
  if (params?.pageSize) url.searchParams.set("pageSize", String(params.pageSize));
  const res = await fetch(url.toString(), { cache: "no-store", headers: roleHeaders() });
  if (!res.ok) throw new Error(`metrics ${res.status}`);
  return (await res.json()) as MetricsResponse;
}

export async function fetchMetric(metricId: string) {

  const res = await fetch(`${BASE}/metrics/${encodeURIComponent(metricId)}`, { cache: "no-store", headers: roleHeaders() });
  if (!res.ok) throw new Error(`metric ${res.status}`);
  return (await res.json()) as MetricResponse;
}

export async function testPing(payload?: { metricId?: string }) {
  const res = await fetch(`${BASE}/test-ping`, { method: "POST", headers: roleHeaders({ "content-type": "application/json" }), body: JSON.stringify(payload ?? {}) });
  if (!res.ok) throw new Error(`test-ping ${res.status}`);
  return (await res.json()) as TestResponse;
}

export async function testRoundTrip(payload?: { metricId?: string }) {
  const res = await fetch(`${BASE}/test-round-trip`, { method: "POST", headers: roleHeaders({ "content-type": "application/json" }), body: JSON.stringify(payload ?? {}) });
  if (!res.ok) throw new Error(`test-round-trip ${res.status}`);
  return (await res.json()) as TestResponse;
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
  const res = await fetch(`${BASE}/thresholds/${thresholdId}`, { method: "PATCH", headers: roleHeaders({ "content-type": "application/json" }), body: JSON.stringify(patch) });
  if (!res.ok) throw new Error(`thresholds-patch ${res.status}`);
  return (await res.json()) as ActionResponse;
}

export async function disableRoute(payload: { metricId: string }) {
  const res = await fetch(`${BASE}/disable-route`, { method: "POST", headers: roleHeaders({ "content-type": "application/json" }), body: JSON.stringify(payload) });
  if (!res.ok) throw new Error(`disable-route ${res.status}`);
  return (await res.json()) as ActionResponse;
}

export async function enableRoute(payload: { metricId: string }) {
  const res = await fetch(`${BASE}/enable-route`, { method: "POST", headers: roleHeaders({ "content-type": "application/json" }), body: JSON.stringify(payload) });
  if (!res.ok) throw new Error(`enable-route ${res.status}`);
  return (await res.json()) as ActionResponse;
}

export async function runDiagnostics() {
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


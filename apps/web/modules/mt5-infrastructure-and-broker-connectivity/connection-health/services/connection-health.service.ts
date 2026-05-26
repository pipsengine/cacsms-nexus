import type {
  ActionResponse,
  AiDiagnosticsResponse,
  ComponentResponse,
  ComponentsResponse,
  ConnectionHealthSummaryResponse,
  DependencyMapResponse,
  HeartbeatsResponse,
  IncidentsResponse,
  LatencyResponse,
  LogsResponse,
  PacketLossResponse,
  WorkflowResponse
} from "../types/connection-health.types";
import { useConnectionHealthStore } from "../stores/connection-health.store";

const BASE = "/api/mt5/connection-health";

function roleHeaders(extra?: HeadersInit): HeadersInit {
  const role = useConnectionHealthStore.getState().role;
  return { "x-mt5-role": role, ...(extra ?? {}) };
}

export async function fetchConnectionHealthSummary() {
  const res = await fetch(`${BASE}/summary`, { cache: "no-store", headers: roleHeaders() });
  if (!res.ok) throw new Error(`summary ${res.status}`);
  return (await res.json()) as ConnectionHealthSummaryResponse;
}

export async function fetchConnectionComponents(params?: { search?: string; type?: string; status?: string; page?: number; pageSize?: number }) {
  const url = new URL(`${BASE}/components`, typeof window !== "undefined" ? window.location.origin : "http://localhost");
  if (params?.search) url.searchParams.set("search", params.search);
  if (params?.type) url.searchParams.set("type", params.type);
  if (params?.status) url.searchParams.set("status", params.status);
  if (params?.page) url.searchParams.set("page", String(params.page));
  if (params?.pageSize) url.searchParams.set("pageSize", String(params.pageSize));
  const res = await fetch(url.toString(), { cache: "no-store", headers: roleHeaders() });
  if (!res.ok) throw new Error(`components ${res.status}`);
  return (await res.json()) as ComponentsResponse;
}

export async function fetchConnectionComponent(componentId: string) {
  const res = await fetch(`${BASE}/components/${componentId}`, { cache: "no-store", headers: roleHeaders() });
  if (!res.ok) throw new Error(`component ${res.status}`);
  return (await res.json()) as ComponentResponse;
}

export async function fetchConnectionWorkflow() {
  const res = await fetch(`${BASE}/workflow`, { cache: "no-store", headers: roleHeaders() });
  if (!res.ok) throw new Error(`workflow ${res.status}`);
  return (await res.json()) as WorkflowResponse;
}

export async function fetchDependencyMap() {
  const res = await fetch(`${BASE}/dependency-map`, { cache: "no-store", headers: roleHeaders() });
  if (!res.ok) throw new Error(`dependency-map ${res.status}`);
  return (await res.json()) as DependencyMapResponse;
}

export async function fetchLatency() {
  const res = await fetch(`${BASE}/latency`, { cache: "no-store", headers: roleHeaders() });
  if (!res.ok) throw new Error(`latency ${res.status}`);
  return (await res.json()) as LatencyResponse;
}

export async function fetchPacketLoss() {
  const res = await fetch(`${BASE}/packet-loss`, { cache: "no-store", headers: roleHeaders() });
  if (!res.ok) throw new Error(`packet-loss ${res.status}`);
  return (await res.json()) as PacketLossResponse;
}

export async function fetchHeartbeats() {
  const res = await fetch(`${BASE}/heartbeats`, { cache: "no-store", headers: roleHeaders() });
  if (!res.ok) throw new Error(`heartbeats ${res.status}`);
  return (await res.json()) as HeartbeatsResponse;
}

export async function fetchIncidents(filter?: string) {
  const url = new URL(`${BASE}/incidents`, typeof window !== "undefined" ? window.location.origin : "http://localhost");
  if (filter) url.searchParams.set("filter", filter);
  const res = await fetch(url.toString(), { cache: "no-store", headers: roleHeaders() });
  if (!res.ok) throw new Error(`incidents ${res.status}`);
  return (await res.json()) as IncidentsResponse;
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

export async function postRunFullDiagnostics() {
  const res = await fetch(`${BASE}/full-diagnostics`, { method: "POST", headers: roleHeaders() });
  if (!res.ok) throw new Error(`full-diagnostics ${res.status}`);
  return (await res.json()) as ActionResponse;
}

export async function postReconnectFailedServices() {
  const res = await fetch(`${BASE}/reconnect-failed`, { method: "POST", headers: roleHeaders() });
  if (!res.ok) throw new Error(`reconnect-failed ${res.status}`);
  return (await res.json()) as ActionResponse;
}

export async function postRestartUnhealthyChannels() {
  const res = await fetch(`${BASE}/restart-unhealthy`, { method: "POST", headers: roleHeaders() });
  if (!res.ok) throw new Error(`restart-unhealthy ${res.status}`);
  return (await res.json()) as ActionResponse;
}

export async function postDisableUnsafeTrading() {
  const res = await fetch(`${BASE}/disable-unsafe-trading`, { method: "POST", headers: roleHeaders() });
  if (!res.ok) throw new Error(`disable-unsafe-trading ${res.status}`);
  return (await res.json()) as ActionResponse;
}

export async function postComponentDiagnostics(componentId: string) {
  const res = await fetch(`${BASE}/components/${componentId}/diagnostics`, { method: "POST", headers: roleHeaders() });
  if (!res.ok) throw new Error(`component-diagnostics ${res.status}`);
  return (await res.json()) as ActionResponse;
}

export async function postComponentReconnect(componentId: string) {
  const res = await fetch(`${BASE}/components/${componentId}/reconnect`, { method: "POST", headers: roleHeaders() });
  if (!res.ok) throw new Error(`component-reconnect ${res.status}`);
  return (await res.json()) as ActionResponse;
}

export async function postComponentRestart(componentId: string) {
  const res = await fetch(`${BASE}/components/${componentId}/restart`, { method: "POST", headers: roleHeaders() });
  if (!res.ok) throw new Error(`component-restart ${res.status}`);
  return (await res.json()) as ActionResponse;
}

export async function postDisableTradingPath(componentId: string) {
  const res = await fetch(`${BASE}/components/${componentId}/disable-trading-path`, { method: "POST", headers: roleHeaders() });
  if (!res.ok) throw new Error(`disable-trading-path ${res.status}`);
  return (await res.json()) as ActionResponse;
}

export async function postAutoRemediate() {
  const res = await fetch(`${BASE}/auto-remediate`, { method: "POST", headers: roleHeaders() });
  if (!res.ok) throw new Error(`auto-remediate ${res.status}`);
  return (await res.json()) as ActionResponse;
}

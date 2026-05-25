import type { Mt5Role } from "../../mt5-control-center/types/mt5-control-center.types";
import {
  createMockComponents,
  createMockDependencyMap,
  createMockDiagnostics,
  createMockHeartbeats,
  createMockIncidents,
  createMockLatencyAndPacketLoss,
  createMockLogs,
  createMockWorkflow
} from "../data/connection-health.mock";
import type {
  ActionResponse,
  AiDiagnosticsResponse,
  ComponentResponse,
  ComponentsResponse,
  ConnectionComponent,
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

function nowIso() {
  return new Date().toISOString();
}

function mockOnly() {
  return typeof window !== "undefined" && window.location.search.includes("mock=1");
}

function roleHeaders(extra?: HeadersInit): HeadersInit {
  const role = useConnectionHealthStore.getState().role;
  return { "x-mt5-role": role, ...(extra ?? {}) };
}

type MockState = {
  components: ConnectionComponent[];
  incidents: ReturnType<typeof createMockIncidents>;
  logs: ReturnType<typeof createMockLogs>;
  emergencyStopActive: boolean;
};

let mockState: MockState | null = null;

function ensureMockState(): MockState {
  if (mockState) return mockState;
  mockState = {
    components: createMockComponents(),
    incidents: createMockIncidents(),
    logs: createMockLogs(),
    emergencyStopActive: false
  };
  return mockState;
}

function paged<T>(rows: T[], page = 1, pageSize = 60) {
  const start = (page - 1) * pageSize;
  return rows.slice(start, start + pageSize);
}

function mockComponents(params?: { search?: string; type?: string; status?: string; page?: number; pageSize?: number }): ComponentsResponse {
  const state = ensureMockState();
  const search = params?.search?.trim().toLowerCase() ?? "";
  const type = params?.type ?? "all";
  const status = params?.status ?? "all";
  const page = params?.page ?? 1;
  const pageSize = params?.pageSize ?? 60;

  const filtered = state.components.filter((c) => {
    const matchesSearch =
      !search ||
      [c.componentId, c.componentType, c.componentName, c.broker ?? "", c.account ?? "", c.terminal ?? "", c.eaInstance ?? "", c.hostMachine, c.connectionStatus, c.riskLevel]
        .join(" ")
        .toLowerCase()
        .includes(search);
    const matchesType = type === "all" ? true : c.componentType === type;
    const matchesStatus = status === "all" ? true : c.connectionStatus === status || c.heartbeatStatus === status || c.riskLevel === status;
    return matchesSearch && matchesType && matchesStatus;
  });

  return { meta: { timestamp: nowIso(), total: filtered.length, page, pageSize }, components: paged(filtered, page, pageSize) };
}

function mockComponent(componentId: string): ComponentResponse {
  const state = ensureMockState();
  const component = state.components.find((c) => c.componentId === componentId);
  if (!component) throw new Error("Component not found.");
  return { meta: { timestamp: nowIso() }, component };
}

function mockSummary(role: Mt5Role): ConnectionHealthSummaryResponse {
  const state = ensureMockState();
  const { nodes, edges } = createMockDependencyMap(state.components);
  const failedEdges = edges.filter((e) => e.status !== "Healthy").length;
  const overall = Math.max(0, Math.min(100, Math.round(state.components.reduce((sum, c) => sum + c.healthScore, 0) / Math.max(1, state.components.length) - failedEdges * 6)));

  const avgLatency = Math.round(state.components.reduce((sum, c) => sum + c.latencyMs, 0) / Math.max(1, state.components.length));
  const highestLatencyComponent = [...state.components].sort((a, b) => b.latencyMs - a.latencyMs)[0];
  const activeHeartbeats = state.components.filter((c) => c.heartbeatStatus === "Healthy" || c.heartbeatStatus === "Watch").length;
  const missedHeartbeats = state.components.filter((c) => c.heartbeatStatus === "Degraded" || c.heartbeatStatus === "Critical" || c.heartbeatStatus === "Offline").length;
  const marketFeedHealth = Math.round(state.components.filter((c) => c.componentType === "Market Data Feed").reduce((sum, c) => sum + c.healthScore, 0) / Math.max(1, state.components.filter((c) => c.componentType === "Market Data Feed").length));
  const executionChannelHealth = Math.round(
    state.components.filter((c) => c.componentType === "EA Bridge" || c.componentType === "MT5 Feedback").reduce((sum, c) => sum + c.healthScore, 0) /
      Math.max(1, state.components.filter((c) => c.componentType === "EA Bridge" || c.componentType === "MT5 Feedback").length)
  );

  const healthy = state.components.filter((c) => c.connectionStatus === "Healthy").length;
  const degraded = state.components.filter((c) => c.connectionStatus === "Degraded" || c.connectionStatus === "Syncing").length;
  const critical = state.components.filter((c) => c.connectionStatus === "Critical").length;
  const offline = state.components.filter((c) => c.connectionStatus === "Offline").length;

  const infrastructureRiskLevel = overall < 45 || offline > 0 || critical > 0 ? "Critical" : overall < 60 ? "High" : overall < 75 ? "Moderate" : "Low";

  return {
    meta: { timestamp: nowIso(), currentRole: role, streamEndpoint: "/api/mt5/connection-health/events-stream" },
    overallHealth: { score: overall, rating: overall >= 90 ? "Excellent" : overall >= 75 ? "Healthy" : overall >= 60 ? "Degraded" : overall >= 40 ? "High Risk" : "Critical", factors: {} },
    infrastructureRiskLevel,
    kpis: [
      { label: "Overall Connection Health Score", value: `${overall}/100`, status: overall >= 75 ? "Healthy" : overall >= 60 ? "Degraded" : "Critical", detail: "Composite MT5 infrastructure health score", updatedAt: nowIso() },
      { label: "Healthy Services", value: String(healthy), status: "Healthy", detail: "Components operating normally", updatedAt: nowIso() },
      { label: "Degraded Services", value: String(degraded), status: degraded > 4 ? "Degraded" : "Watch", detail: "Components with elevated latency/packet loss", updatedAt: nowIso() },
      { label: "Critical Services", value: String(critical), status: critical > 0 ? "Critical" : "Healthy", detail: "Components requiring immediate attention", updatedAt: nowIso() },
      { label: "Offline Services", value: String(offline), status: offline > 0 ? "Critical" : "Healthy", detail: "Disconnected components", updatedAt: nowIso() },
      { label: "Average Latency", value: `${avgLatency}ms`, status: avgLatency > 250 ? "Degraded" : avgLatency > 150 ? "Watch" : "Healthy", detail: "Average latency across components", updatedAt: nowIso() },
      { label: "Highest Latency Component", value: highestLatencyComponent ? highestLatencyComponent.componentName : "—", status: "Watch", detail: highestLatencyComponent ? `${highestLatencyComponent.latencyMs}ms` : "—", updatedAt: nowIso() },
      { label: "Active Heartbeats", value: String(activeHeartbeats), status: "Healthy", detail: "Healthy/watch heartbeat streams", updatedAt: nowIso() },
      { label: "Missed Heartbeats", value: String(missedHeartbeats), status: missedHeartbeats > 0 ? "Degraded" : "Healthy", detail: "Degraded/critical/offline heartbeats", updatedAt: nowIso() },
      { label: "Market Feed Health", value: `${marketFeedHealth}/100`, status: marketFeedHealth >= 75 ? "Healthy" : marketFeedHealth >= 60 ? "Degraded" : "Critical", detail: "Tick feed + symbol availability health", updatedAt: nowIso() },
      { label: "Execution Channel Health", value: `${executionChannelHealth}/100`, status: executionChannelHealth >= 75 ? "Healthy" : executionChannelHealth >= 60 ? "Degraded" : "Critical", detail: "EA bridge + feedback channel health", updatedAt: nowIso() },
      { label: "Infrastructure Risk Level", value: infrastructureRiskLevel, status: infrastructureRiskLevel === "Critical" ? "Critical" : infrastructureRiskLevel === "High" ? "Degraded" : "Healthy", detail: "Trading path risk posture", updatedAt: nowIso() }
    ]
  };
}

export async function fetchConnectionHealthSummary() {
  if (mockOnly()) return mockSummary(useConnectionHealthStore.getState().role);
  const res = await fetch(`${BASE}/summary`, { cache: "no-store", headers: roleHeaders() });
  if (!res.ok) throw new Error(`summary ${res.status}`);
  return (await res.json()) as ConnectionHealthSummaryResponse;
}

export async function fetchConnectionComponents(params?: { search?: string; type?: string; status?: string; page?: number; pageSize?: number }) {
  if (mockOnly()) return mockComponents(params);
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
  if (mockOnly()) return mockComponent(componentId);
  const res = await fetch(`${BASE}/components/${componentId}`, { cache: "no-store", headers: roleHeaders() });
  if (!res.ok) throw new Error(`component ${res.status}`);
  return (await res.json()) as ComponentResponse;
}

export async function fetchConnectionWorkflow() {
  if (mockOnly()) {
    const state = ensureMockState();
    return { meta: { timestamp: nowIso() }, workflow: createMockWorkflow(state.components) } satisfies WorkflowResponse;
  }
  const res = await fetch(`${BASE}/workflow`, { cache: "no-store", headers: roleHeaders() });
  if (!res.ok) throw new Error(`workflow ${res.status}`);
  return (await res.json()) as WorkflowResponse;
}

export async function fetchDependencyMap() {
  if (mockOnly()) {
    const state = ensureMockState();
    return createMockDependencyMap(state.components);
  }
  const res = await fetch(`${BASE}/dependency-map`, { cache: "no-store", headers: roleHeaders() });
  if (!res.ok) throw new Error(`dependency-map ${res.status}`);
  return (await res.json()) as DependencyMapResponse;
}

export async function fetchLatency() {
  if (mockOnly()) {
    const { latency } = createMockLatencyAndPacketLoss();
    return { meta: { timestamp: nowIso() }, points: latency } satisfies LatencyResponse;
  }
  const res = await fetch(`${BASE}/latency`, { cache: "no-store", headers: roleHeaders() });
  if (!res.ok) throw new Error(`latency ${res.status}`);
  return (await res.json()) as LatencyResponse;
}

export async function fetchPacketLoss() {
  if (mockOnly()) {
    const { packetLoss } = createMockLatencyAndPacketLoss();
    return { meta: { timestamp: nowIso() }, points: packetLoss } satisfies PacketLossResponse;
  }
  const res = await fetch(`${BASE}/packet-loss`, { cache: "no-store", headers: roleHeaders() });
  if (!res.ok) throw new Error(`packet-loss ${res.status}`);
  return (await res.json()) as PacketLossResponse;
}

export async function fetchHeartbeats() {
  if (mockOnly()) {
    const state = ensureMockState();
    const heartbeats = createMockHeartbeats(state.components);
    return { meta: { timestamp: nowIso(), total: heartbeats.length }, heartbeats } satisfies HeartbeatsResponse;
  }
  const res = await fetch(`${BASE}/heartbeats`, { cache: "no-store", headers: roleHeaders() });
  if (!res.ok) throw new Error(`heartbeats ${res.status}`);
  return (await res.json()) as HeartbeatsResponse;
}

export async function fetchIncidents(filter?: string) {
  if (mockOnly()) {
    const state = ensureMockState();
    const normalized = filter?.trim().toLowerCase() ?? "";
    const incidents = normalized
      ? state.incidents.filter((i) => [i.componentType, i.incidentType, i.severity, i.errorMessage, i.resolutionStatus].join(" ").toLowerCase().includes(normalized))
      : state.incidents;
    return { meta: { timestamp: nowIso(), total: incidents.length }, incidents } satisfies IncidentsResponse;
  }
  const url = new URL(`${BASE}/incidents`, typeof window !== "undefined" ? window.location.origin : "http://localhost");
  if (filter) url.searchParams.set("filter", filter);
  const res = await fetch(url.toString(), { cache: "no-store", headers: roleHeaders() });
  if (!res.ok) throw new Error(`incidents ${res.status}`);
  return (await res.json()) as IncidentsResponse;
}

export async function fetchLogs(filter?: string) {
  if (mockOnly()) {
    const state = ensureMockState();
    const normalized = filter?.trim().toLowerCase() ?? "";
    const logs = normalized ? state.logs.filter((l) => [l.componentType, l.eventType, l.severity, l.message].join(" ").toLowerCase().includes(normalized)) : state.logs;
    return { meta: { timestamp: nowIso(), total: logs.length }, logs } satisfies LogsResponse;
  }
  const url = new URL(`${BASE}/logs`, typeof window !== "undefined" ? window.location.origin : "http://localhost");
  if (filter) url.searchParams.set("filter", filter);
  const res = await fetch(url.toString(), { cache: "no-store", headers: roleHeaders() });
  if (!res.ok) throw new Error(`logs ${res.status}`);
  return (await res.json()) as LogsResponse;
}

export async function fetchAiDiagnostics() {
  if (mockOnly()) return createMockDiagnostics();
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

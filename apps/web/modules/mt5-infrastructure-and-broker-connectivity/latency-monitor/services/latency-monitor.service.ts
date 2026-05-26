import { createLatencyMonitorSeed } from "../data/latency-monitor.mock";
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

function nowIso() {
  return new Date().toISOString();
}

function mockOnly() {
  return typeof window !== "undefined" && window.location.search.includes("mock=1");
}

function roleHeaders(extra?: HeadersInit): HeadersInit {
  const role = useLatencyMonitorStore.getState().role;
  return { "x-mt5-role": role, ...(extra ?? {}) };
}

type MockState = ReturnType<typeof createLatencyMonitorSeed>;
let mockState: MockState | null = null;
function ensureMockState(): MockState {
  if (mockState) return mockState;
  mockState = createLatencyMonitorSeed();
  return mockState;
}

function paged<T>(rows: T[], page = 1, pageSize = 75) {
  const start = (page - 1) * pageSize;
  return rows.slice(start, start + pageSize);
}

export async function fetchLatencySummary() {
  if (mockOnly()) {
    const state = ensureMockState();
    return {
      meta: { timestamp: nowIso(), currentRole: useLatencyMonitorStore.getState().role, streamEndpoint: "/api/mt5/latency-monitor/events-stream" },
      kpis: [],
      latencyRiskScore: { score: 76, rating: "Healthy", factors: {} }
    } satisfies LatencyMonitorSummaryResponse;
  }
  const res = await fetch(`${BASE}/summary`, { cache: "no-store", headers: roleHeaders() });
  if (!res.ok) throw new Error(`summary ${res.status}`);
  return (await res.json()) as LatencyMonitorSummaryResponse;
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

export async function fetchMetrics(params?: { search?: string; componentType?: string; breach?: string; brokerId?: string; page?: number; pageSize?: number }) {
  if (mockOnly()) {
    const state = ensureMockState();
    const search = params?.search?.trim().toLowerCase() ?? "";
    const componentType = params?.componentType ?? "all";
    const breach = params?.breach ?? "all";
    const brokerId = params?.brokerId ?? "all";
    const page = params?.page ?? 1;
    const pageSize = params?.pageSize ?? 75;
    const filtered = state.metrics.filter((m) => {
      const matchesSearch =
        !search ||
        [m.metricId, m.componentType, m.componentName, m.broker ?? "", m.account ?? "", m.terminal ?? "", m.eaInstance ?? "", m.symbol ?? "", m.latencyType, m.breachStatus, m.riskLevel]
          .join(" ")
          .toLowerCase()
          .includes(search);
      const matchesComponent = componentType === "all" ? true : m.componentType === componentType;
      const matchesBreach = breach === "all" ? true : m.breachStatus === breach || m.riskLevel === breach;
      const matchesBroker = brokerId === "all" ? true : m.brokerId === brokerId;
      return matchesSearch && matchesComponent && matchesBreach && matchesBroker;
    });
    return { meta: { timestamp: nowIso(), total: filtered.length, page, pageSize }, metrics: paged(filtered, page, pageSize) } satisfies MetricsResponse;
  }

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
  if (mockOnly()) {
    const state = ensureMockState();
    const metric = state.metrics.find((m) => m.metricId === metricId || m.id === metricId);
    if (!metric) throw new Error("Metric not found.");
    return { meta: { timestamp: nowIso() }, metric } satisfies MetricResponse;
  }
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
  if (mockOnly()) {
    const state = ensureMockState();
    return { meta: { timestamp: nowIso(), total: state.brokerComparison.length }, comparisons: state.brokerComparison } satisfies BrokerComparisonResponse;
  }
  const res = await fetch(`${BASE}/broker-comparison`, { cache: "no-store", headers: roleHeaders() });
  if (!res.ok) throw new Error(`broker-comparison ${res.status}`);
  return (await res.json()) as BrokerComparisonResponse;
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

export async function fetchThresholds() {
  if (mockOnly()) {
    const state = ensureMockState();
    return { meta: { timestamp: nowIso(), total: state.thresholds.length }, thresholds: state.thresholds } satisfies ThresholdsResponse;
  }
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
  if (mockOnly()) {
    const state = ensureMockState();
    const normalized = filter?.trim().toLowerCase() ?? "";
    const alerts = normalized ? state.alerts.filter((a) => [a.alertType, a.severity, a.resolutionStatus, a.componentName].join(" ").toLowerCase().includes(normalized)) : state.alerts;
    return { meta: { timestamp: nowIso(), total: alerts.length }, alerts } satisfies AlertsResponse;
  }
  const url = new URL(`${BASE}/alerts`, typeof window !== "undefined" ? window.location.origin : "http://localhost");
  if (filter) url.searchParams.set("filter", filter);
  const res = await fetch(url.toString(), { cache: "no-store", headers: roleHeaders() });
  if (!res.ok) throw new Error(`alerts ${res.status}`);
  return (await res.json()) as AlertsResponse;
}

export async function fetchLogs(filter?: string) {
  if (mockOnly()) {
    const state = ensureMockState();
    const normalized = filter?.trim().toLowerCase() ?? "";
    const logs = normalized ? state.logs.filter((l) => [l.eventType, l.severity, l.metricId, l.message].join(" ").toLowerCase().includes(normalized)) : state.logs;
    return { meta: { timestamp: nowIso(), total: logs.length }, logs } satisfies LogsResponse;
  }
  const url = new URL(`${BASE}/logs`, typeof window !== "undefined" ? window.location.origin : "http://localhost");
  if (filter) url.searchParams.set("filter", filter);
  const res = await fetch(url.toString(), { cache: "no-store", headers: roleHeaders() });
  if (!res.ok) throw new Error(`logs ${res.status}`);
  return (await res.json()) as LogsResponse;
}

export async function fetchAiDiagnostics() {
  if (mockOnly()) {
    const state = ensureMockState();
    return { meta: { timestamp: nowIso(), total: state.aiDiagnostics.length }, diagnostics: state.aiDiagnostics } satisfies AiDiagnosticsResponse;
  }
  const res = await fetch(`${BASE}/ai-diagnostics`, { cache: "no-store", headers: roleHeaders() });
  if (!res.ok) throw new Error(`ai-diagnostics ${res.status}`);
  return (await res.json()) as AiDiagnosticsResponse;
}

export async function autoRemediate() {
  const res = await fetch(`${BASE}/auto-remediate`, { method: "POST", headers: roleHeaders() });
  if (!res.ok) throw new Error(`auto-remediate ${res.status}`);
  return (await res.json()) as ActionResponse;
}


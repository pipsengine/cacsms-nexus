import { createSlippageMonitorSeed } from "../data/slippage-monitor.mock";
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

function nowIso() {
  return new Date().toISOString();
}

function mockOnly() {
  return typeof window !== "undefined" && window.location.search.includes("mock=1");
}

function roleHeaders(extra?: HeadersInit): HeadersInit {
  const role = useSlippageMonitorStore.getState().role;
  return { "x-mt5-role": role, ...(extra ?? {}) };
}

type MockState = ReturnType<typeof createSlippageMonitorSeed>;
let mockState: MockState | null = null;

function ensureMockState(): MockState {
  if (mockState) return mockState;
  mockState = createSlippageMonitorSeed();
  return mockState;
}

function paged<T>(rows: T[], page = 1, pageSize = 75) {
  const start = (page - 1) * pageSize;
  return rows.slice(start, start + pageSize);
}

export async function fetchSlippageSummary() {
  if (mockOnly()) {
    const state = ensureMockState();
    return {
      meta: { timestamp: nowIso(), currentRole: useSlippageMonitorStore.getState().role, streamEndpoint: "/api/mt5/slippage-monitor/events-stream" },
      kpis: [],
      slippageRiskScore: { score: 78, rating: "Healthy", factors: {} },
      executionQualityScore: { score: 74, rating: "Degraded", factors: {} }
    } satisfies SlippageMonitorSummaryResponse;
  }
  const res = await fetch(`${BASE}/summary`, { cache: "no-store", headers: roleHeaders() });
  if (!res.ok) throw new Error(`summary ${res.status}`);
  return (await res.json()) as SlippageMonitorSummaryResponse;
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

export async function fetchExecutions(params?: { search?: string; assetClass?: string; breach?: string; brokerId?: string; page?: number; pageSize?: number }) {
  if (mockOnly()) {
    const state = ensureMockState();
    const search = params?.search?.trim().toLowerCase() ?? "";
    const asset = params?.assetClass ?? "all";
    const breach = params?.breach ?? "all";
    const brokerId = params?.brokerId ?? "all";
    const page = params?.page ?? 1;
    const pageSize = params?.pageSize ?? 75;
    const filtered = state.executions.filter((e) => {
      const matchesSearch =
        !search ||
        [e.executionId, e.orderId, e.mt5Ticket ?? "", e.account, e.broker, e.terminal, e.eaInstance, e.symbol, e.normalizedSymbol, e.strategy, e.breachStatus, e.riskLevel]
          .join(" ")
          .toLowerCase()
          .includes(search);
      const matchesAsset = asset === "all" ? true : e.assetClass === asset;
      const matchesBreach = breach === "all" ? true : e.breachStatus === breach || e.riskLevel === breach;
      const matchesBroker = brokerId === "all" ? true : e.brokerId === brokerId;
      return matchesSearch && matchesAsset && matchesBreach && matchesBroker;
    });
    return { meta: { timestamp: nowIso(), total: filtered.length, page, pageSize }, executions: paged(filtered, page, pageSize) } satisfies ExecutionsResponse;
  }

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
  if (mockOnly()) {
    const state = ensureMockState();
    const execution = state.executions.find((e) => e.executionId === executionId || e.id === executionId);
    if (!execution) throw new Error("Execution not found.");
    return { meta: { timestamp: nowIso() }, execution } satisfies ExecutionResponse;
  }
  const res = await fetch(`${BASE}/executions/${encodeURIComponent(executionId)}`, { cache: "no-store", headers: roleHeaders() });
  if (!res.ok) throw new Error(`execution ${res.status}`);
  return (await res.json()) as ExecutionResponse;
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
  if (mockOnly()) {
    const state = ensureMockState();
    const normalized = filter?.trim().toLowerCase() ?? "";
    const alerts = normalized
      ? state.alerts.filter((a) => [a.alertType, a.severity, a.resolutionStatus, a.broker, a.normalizedSymbol].join(" ").toLowerCase().includes(normalized))
      : state.alerts;
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
    const logs = normalized ? state.logs.filter((l: any) => [l.eventType, l.severity, l.symbol, l.message].join(" ").toLowerCase().includes(normalized)) : state.logs;
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


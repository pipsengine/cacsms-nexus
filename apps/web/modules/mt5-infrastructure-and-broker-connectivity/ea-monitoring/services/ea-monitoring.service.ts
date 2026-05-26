import { createEaMonitoringSeed } from "../data/ea-monitoring.mock";
import type {
  ActionResponse,
  AiDiagnosticsResponse,
  AnalyticsResponse,
  AuditResponse,
  CommandsResponse,
  EaInstance,
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

function nowIso() {
  return new Date().toISOString();
}

function mockOnly() {
  return typeof window !== "undefined" && window.location.search.includes("mock=1");
}

function roleHeaders(extra?: HeadersInit): HeadersInit {
  const role = useEaMonitoringStore.getState().role;
  return { "x-mt5-role": role, ...(extra ?? {}) };
}

type MockState = ReturnType<typeof createEaMonitoringSeed>;
let mockState: MockState | null = null;
function ensureMockState(): MockState {
  if (mockState) return mockState;
  mockState = createEaMonitoringSeed();
  return mockState;
}

function paged<T>(rows: T[], page = 1, pageSize = 75) {
  const start = (page - 1) * pageSize;
  return rows.slice(start, start + pageSize);
}

function applyInstanceFilters(instances: EaInstance[], params?: { search?: string; status?: string; risk?: string; trading?: string }) {
  const search = params?.search?.trim().toLowerCase() ?? "";
  const status = params?.status ?? "all";
  const risk = params?.risk ?? "all";
  const trading = params?.trading ?? "all";

  return instances.filter((e) => {
    const matchesSearch =
      !search ||
      [
        e.eaId,
        e.eaName,
        e.eaVersion,
        e.buildNumber,
        e.terminal,
        e.broker,
        e.accountLogin,
        e.strategyName ?? "",
        e.symbolScope.join(","),
        e.connectionStatus,
        e.heartbeatStatus,
        e.bridgeStatus,
        e.lastError ?? "",
        e.riskLevel
      ]
        .join(" ")
        .toLowerCase()
        .includes(search);

    const matchesStatus = status === "all" ? true : e.connectionStatus === status;
    const matchesRisk = risk === "all" ? true : e.riskLevel === risk;
    const matchesTrading = trading === "all" ? true : trading === "enabled" ? e.tradingEnabled : !e.tradingEnabled;
    return matchesSearch && matchesStatus && matchesRisk && matchesTrading;
  });
}

export async function fetchEaSummary() {
  if (mockOnly()) {
    const state = ensureMockState();
    return {
      meta: { timestamp: nowIso(), currentRole: useEaMonitoringStore.getState().role, streamEndpoint: "/api/mt5/ea-monitoring/events-stream" },
      kpis: state.kpis,
      eaHealthScore: state.eaHealthScore
    } satisfies EaMonitoringSummaryResponse;
  }
  const res = await fetch(`${BASE}/summary`, { cache: "no-store", headers: roleHeaders() });
  if (!res.ok) throw new Error(`summary ${res.status}`);
  return (await res.json()) as EaMonitoringSummaryResponse;
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

export async function fetchInstances(params?: { search?: string; status?: string; risk?: string; trading?: string; page?: number; pageSize?: number }) {
  if (mockOnly()) {
    const state = ensureMockState();
    const page = params?.page ?? 1;
    const pageSize = params?.pageSize ?? 75;
    const filtered = applyInstanceFilters(state.instances, params);
    const sorted = [...filtered].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return { meta: { timestamp: nowIso(), total: filtered.length, page, pageSize }, instances: paged(sorted, page, pageSize) } satisfies InstancesResponse;
  }
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
  if (mockOnly()) {
    const state = ensureMockState();
    const instance = state.instances.find((e) => e.eaId === eaId || e.id === eaId);
    if (!instance) throw new Error("EA not found.");
    return { meta: { timestamp: nowIso() }, instance } satisfies InstanceResponse;
  }
  const res = await fetch(`${BASE}/instances/${encodeURIComponent(eaId)}`, { cache: "no-store", headers: roleHeaders() });
  if (!res.ok) throw new Error(`instance ${res.status}`);
  return (await res.json()) as InstanceResponse;
}

export async function fetchCommands(params?: { search?: string; page?: number; pageSize?: number }) {
  if (mockOnly()) {
    const state = ensureMockState();
    const search = params?.search?.trim().toLowerCase() ?? "";
    const page = params?.page ?? 1;
    const pageSize = params?.pageSize ?? 75;
    const filtered = state.commands.filter((c) => !search || [c.commandId, c.eaId, c.eaInstance, c.strategyName ?? "", c.account, c.broker, c.symbol, c.commandType, c.commandStatus, c.failureReason ?? ""].join(" ").toLowerCase().includes(search));
    const sorted = [...filtered].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return { meta: { timestamp: nowIso(), total: filtered.length, page, pageSize }, commands: paged(sorted, page, pageSize) } satisfies CommandsResponse;
  }
  const url = new URL(`${BASE}/commands`, typeof window !== "undefined" ? window.location.origin : "http://localhost");
  if (params?.search) url.searchParams.set("search", params.search);
  if (params?.page) url.searchParams.set("page", String(params.page));
  if (params?.pageSize) url.searchParams.set("pageSize", String(params.pageSize));
  const res = await fetch(url.toString(), { cache: "no-store", headers: roleHeaders() });
  if (!res.ok) throw new Error(`commands ${res.status}`);
  return (await res.json()) as CommandsResponse;
}

export async function fetchStrategyBindings() {
  if (mockOnly()) {
    const state = ensureMockState();
    return { meta: { timestamp: nowIso(), total: state.bindings.length }, bindings: state.bindings } satisfies StrategyBindingsResponse;
  }
  const res = await fetch(`${BASE}/strategy-bindings`, { cache: "no-store", headers: roleHeaders() });
  if (!res.ok) throw new Error(`strategy-bindings ${res.status}`);
  return (await res.json()) as StrategyBindingsResponse;
}

export async function fetchLogs(filter?: string) {
  if (mockOnly()) {
    const state = ensureMockState();
    const f = filter?.trim().toLowerCase() ?? "";
    const rows = f ? state.logs.filter((l) => [l.severity, l.errorType, l.message, l.eaId, l.terminal, l.broker, l.account, l.resolutionStatus].join(" ").toLowerCase().includes(f)) : state.logs;
    return { meta: { timestamp: nowIso(), total: rows.length }, logs: rows } satisfies LogsResponse;
  }
  const url = new URL(`${BASE}/logs`, typeof window !== "undefined" ? window.location.origin : "http://localhost");
  if (filter) url.searchParams.set("filter", filter);
  const res = await fetch(url.toString(), { cache: "no-store", headers: roleHeaders() });
  if (!res.ok) throw new Error(`logs ${res.status}`);
  return (await res.json()) as LogsResponse;
}

export async function fetchExceptions(filter?: string) {
  if (mockOnly()) {
    const state = ensureMockState();
    const f = filter?.trim().toLowerCase() ?? "";
    const rows = f ? state.exceptions.filter((e) => [e.exceptionType, e.severity, e.resolutionStatus, e.rootCause, e.aiExplanation, e.eaId, e.terminal, e.broker, e.account].join(" ").toLowerCase().includes(f)) : state.exceptions;
    return { meta: { timestamp: nowIso(), total: rows.length }, exceptions: rows } satisfies ExceptionsResponse;
  }
  const url = new URL(`${BASE}/exceptions`, typeof window !== "undefined" ? window.location.origin : "http://localhost");
  if (filter) url.searchParams.set("filter", filter);
  const res = await fetch(url.toString(), { cache: "no-store", headers: roleHeaders() });
  if (!res.ok) throw new Error(`exceptions ${res.status}`);
  return (await res.json()) as ExceptionsResponse;
}

export async function fetchAnalytics() {
  if (mockOnly()) {
    const state = ensureMockState();
    return { meta: { timestamp: nowIso(), total: state.analytics.length }, points: state.analytics } satisfies AnalyticsResponse;
  }
  const res = await fetch(`${BASE}/analytics`, { cache: "no-store", headers: roleHeaders() });
  if (!res.ok) throw new Error(`analytics ${res.status}`);
  return (await res.json()) as AnalyticsResponse;
}

export async function fetchAiDiagnostics() {
  if (mockOnly()) {
    const state = ensureMockState();
    return { meta: { timestamp: nowIso(), total: state.diagnostics.length }, diagnostics: state.diagnostics } satisfies AiDiagnosticsResponse;
  }
  const res = await fetch(`${BASE}/ai-diagnostics`, { cache: "no-store", headers: roleHeaders() });
  if (!res.ok) throw new Error(`ai-diagnostics ${res.status}`);
  return (await res.json()) as AiDiagnosticsResponse;
}

export async function fetchAuditTrail() {
  if (mockOnly()) {
    const state = ensureMockState();
    return { meta: { timestamp: nowIso(), total: state.audit.length }, audit: state.audit } satisfies AuditResponse;
  }
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
  if (mockOnly()) {
    const state = ensureMockState();
    const filtered = applyInstanceFilters(state.instances, payload.filters as any);
    const headers = [
      "eaId",
      "eaName",
      "eaVersion",
      "buildNumber",
      "terminal",
      "broker",
      "accountLogin",
      "strategyName",
      "connectionStatus",
      "heartbeatStatus",
      "bridgeStatus",
      "tradingEnabled",
      "commandSuccessRate",
      "failedCommands",
      "averageLatencyMs",
      "lastError",
      "riskLevel",
      "healthScore"
    ];
    const escape = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = [headers.join(","), ...filtered.map((e) => headers.map((h) => escape((e as any)[h])).join(","))].join("\n");
    const json = JSON.stringify({ generatedAt: nowIso(), total: filtered.length, instances: filtered }, null, 2);
    return { meta: { timestamp: nowIso() }, ok: true, message: payload.format === "csv" ? csv : json } satisfies ActionResponse;
  }
  const res = await fetch(`${BASE}/export`, { method: "POST", headers: roleHeaders({ "content-type": "application/json" }), body: JSON.stringify(payload) });
  if (!res.ok) throw new Error(`export ${res.status}`);
  return (await res.json()) as ActionResponse;
}


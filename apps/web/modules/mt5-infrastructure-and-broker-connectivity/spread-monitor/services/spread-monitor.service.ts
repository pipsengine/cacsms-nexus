import type { Mt5Role } from "../../mt5-control-center/types/mt5-control-center.types";
import { createSpreadMonitorSeed } from "../data/spread-monitor.mock";
import { buildBrokerComparison } from "../algorithms/spread-monitor.algorithms";
import type {
  ActionResponse,
  AiDiagnosticsResponse,
  AiSpreadDiagnostic,
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

function nowIso() {
  return new Date().toISOString();
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function rating(score: number) {
  if (score >= 90) return "Excellent" as const;
  if (score >= 75) return "Healthy" as const;
  if (score >= 60) return "Degraded" as const;
  if (score >= 40) return "High Risk" as const;
  return "Critical" as const;
}

function mockOnly() {
  return typeof window !== "undefined" && window.location.search.includes("mock=1");
}

function roleHeaders(extra?: HeadersInit): HeadersInit {
  const role = useSpreadMonitorStore.getState().role;
  return { "x-mt5-role": role, ...(extra ?? {}) };
}

type MockState = ReturnType<typeof createSpreadMonitorSeed> & { role: Mt5Role };

let mockState: MockState | null = null;

function ensureMockState(): MockState {
  if (mockState) return mockState;
  const seed = createSpreadMonitorSeed();
  mockState = { ...seed, role: "Read-Only Viewer" };
  return mockState;
}

function paged<T>(rows: T[], page = 1, pageSize = 60) {
  const start = (page - 1) * pageSize;
  return rows.slice(start, start + pageSize);
}

export async function fetchSpreadSummary() {
  if (mockOnly()) {
    const state = ensureMockState();
    const symbols = new Set(state.spreads.map((s) => s.normalizedSymbol)).size;
    const brokers = new Set(state.spreads.map((s) => s.brokerId)).size;
    const normal = state.spreads.filter((s) => s.spreadStatus === "Normal").length;
    const wide = state.spreads.filter((s) => s.spreadStatus === "Wide").length;
    const critical = state.spreads.filter((s) => s.spreadStatus === "Critical").length;
    const avgSpread = state.spreads.length ? state.spreads.reduce((sum, s) => sum + s.currentSpreadPips, 0) / state.spreads.length : 0;
    const highest = [...state.spreads].sort((a, b) => b.currentSpreadPips - a.currentSpreadPips)[0];
    const spikeEvents = state.alerts.filter((a) => a.alertType.includes("Spike") && a.resolutionStatus !== "Resolved").length;
    const blockedExecutions = state.spreads.filter((s) => !s.executionAllowed).length;
    const criticalAlerts = state.alerts.filter((a) => a.severity === "Critical" && a.resolutionStatus !== "Resolved").length;

    const byBroker = new Map<string, { broker: string; avg: number; stability: number; count: number }>();
    for (const row of state.spreads) {
      const prev = byBroker.get(row.brokerId) ?? { broker: row.broker, avg: 0, stability: 0, count: 0 };
      byBroker.set(row.brokerId, { broker: row.broker, avg: prev.avg + row.currentSpreadPips, stability: prev.stability + row.spreadStabilityScore, count: prev.count + 1 });
    }
    const brokerStats = [...byBroker.values()].map((b) => ({ ...b, avg: b.count ? b.avg / b.count : 0, stability: b.count ? b.stability / b.count : 0 }));
    const mostStable = [...brokerStats].sort((a, b) => b.stability - a.stability)[0];
    const mostExpensive = [...brokerStats].sort((a, b) => b.avg - a.avg)[0];

    const risk = clamp(blockedExecutions * 10 + critical * 6 + wide * 2 + spikeEvents * 4, 0, 100);
    const safetyScore = clamp(100 - risk, 0, 100);

    return {
      meta: { timestamp: nowIso(), currentRole: useSpreadMonitorStore.getState().role, streamEndpoint: "/api/mt5/spread-monitor/events-stream" },
      kpis: [
        { label: "Symbols Monitored", value: String(symbols), status: "Healthy", detail: "Normalized symbols under watch", updatedAt: nowIso() },
        { label: "Brokers Monitored", value: String(brokers), status: "Healthy", detail: "Broker routes reporting spreads", updatedAt: nowIso() },
        { label: "Normal Spread Symbols", value: String(normal), status: wide > 0 ? "Watch" : "Healthy", detail: "Rows at/below warning limit", updatedAt: nowIso() },
        { label: "Wide Spread Symbols", value: String(wide), status: wide > 0 ? "Degraded" : "Healthy", detail: "Rows above warning but below critical", updatedAt: nowIso() },
        { label: "Critical Spread Alerts", value: String(criticalAlerts), status: criticalAlerts > 0 ? "Critical" : "Healthy", detail: "Active critical alerts (unresolved)", updatedAt: nowIso() },
        { label: "Average Spread", value: `${avgSpread.toFixed(2)} pips`, status: avgSpread > 4 ? "Degraded" : "Healthy", detail: "Average current spread across rows", updatedAt: nowIso() },
        { label: "Highest Spread Symbol", value: highest?.normalizedSymbol ?? "—", status: highest && highest.currentSpreadPips > 6 ? "Critical" : "Watch", detail: highest ? `${highest.currentSpreadPips.toFixed(2)} pips` : "—", updatedAt: nowIso() },
        { label: "Most Stable Broker", value: mostStable?.broker ?? "—", status: "Healthy", detail: mostStable ? `${mostStable.stability.toFixed(1)}/100` : "—", updatedAt: nowIso() },
        { label: "Most Expensive Broker", value: mostExpensive?.broker ?? "—", status: mostExpensive && mostExpensive.avg > 4 ? "Degraded" : "Watch", detail: mostExpensive ? `${mostExpensive.avg.toFixed(2)} pips` : "—", updatedAt: nowIso() },
        { label: "Spread Spike Events", value: String(spikeEvents), status: spikeEvents > 0 ? "Degraded" : "Healthy", detail: "Spike alerts currently active", updatedAt: nowIso() },
        { label: "Blocked Executions", value: String(blockedExecutions), status: blockedExecutions > 0 ? "Critical" : "Healthy", detail: "Rows blocked by spread safety", updatedAt: nowIso() },
        { label: "Spread Risk Score", value: `${safetyScore}/100`, status: safetyScore >= 75 ? "Healthy" : safetyScore >= 60 ? "Degraded" : "Critical", detail: rating(safetyScore), updatedAt: nowIso() }
      ],
      spreadRiskScore: { score: safetyScore, rating: rating(safetyScore), factors: { risk } }
    } satisfies SpreadMonitorSummaryResponse;
  }
  const res = await fetch(`${BASE}/summary`, { cache: "no-store", headers: roleHeaders() });
  if (!res.ok) throw new Error(`summary ${res.status}`);
  return (await res.json()) as SpreadMonitorSummaryResponse;
}

export async function fetchSpreads(params?: { search?: string; assetClass?: string; status?: string; brokerId?: string; page?: number; pageSize?: number }) {
  if (mockOnly()) {
    const state = ensureMockState();
    const search = params?.search?.trim().toLowerCase() ?? "";
    const asset = params?.assetClass ?? "all";
    const status = params?.status ?? "all";
    const brokerId = params?.brokerId ?? "all";
    const page = params?.page ?? 1;
    const pageSize = params?.pageSize ?? 60;
    const filtered = state.spreads.filter((r) => {
      const matchesSearch = !search || [r.symbol, r.normalizedSymbol, r.broker, r.account, r.assetClass].join(" ").toLowerCase().includes(search);
      const matchesAsset = asset === "all" ? true : r.assetClass === asset;
      const matchesBroker = brokerId === "all" ? true : r.brokerId === brokerId;
      const matchesStatus = status === "all" ? true : r.spreadStatus === status || r.riskLevel === status;
      return matchesSearch && matchesAsset && matchesBroker && matchesStatus;
    });
    return { meta: { timestamp: nowIso(), total: filtered.length, page, pageSize }, spreads: paged(filtered, page, pageSize) } satisfies SpreadsResponse;
  }

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
  if (mockOnly()) {
    const state = ensureMockState();
    const rows = state.spreads.filter((r) => r.normalizedSymbol === symbol || r.symbol === symbol);
    const normalizedSymbol = rows[0]?.normalizedSymbol ?? symbol;
    const trend = state.trends.filter((p) => p.normalizedSymbol === normalizedSymbol);
    const latestAlerts = state.alerts.filter((a) => a.normalizedSymbol === normalizedSymbol).slice(0, 12);
    return { meta: { timestamp: nowIso() }, symbol, normalizedSymbol, rows, trend, latestAlerts } satisfies SymbolSpreadResponse;
  }
  const res = await fetch(`${BASE}/symbols/${encodeURIComponent(symbol)}`, { cache: "no-store", headers: roleHeaders() });
  if (!res.ok) throw new Error(`symbol ${res.status}`);
  return (await res.json()) as SymbolSpreadResponse;
}

export async function fetchBrokerComparison() {
  if (mockOnly()) {
    const state = ensureMockState();
    const comparisons = buildBrokerComparison(state.spreads);
    return { meta: { timestamp: nowIso(), total: comparisons.length }, comparisons } satisfies BrokerComparisonResponse;
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
  if (mockOnly()) {
    const state = ensureMockState();
    const normalized = filter?.trim().toLowerCase() ?? "";
    const alerts = normalized ? state.alerts.filter((a) => [a.alertType, a.severity, a.resolutionStatus, a.symbol, a.broker].join(" ").toLowerCase().includes(normalized)) : state.alerts;
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
    const logs = normalized ? state.logs.filter((l) => [l.eventType, l.severity, l.symbol, l.message].join(" ").toLowerCase().includes(normalized)) : state.logs;
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
    const diagnostics = state.spreads
      .filter((r) => r.spreadStatus !== "Normal" || !r.executionAllowed || r.spreadDeviationPercent > 85)
      .slice(0, 18)
      .map(
        (r, idx): AiSpreadDiagnostic => ({
        id: `ai-${idx + 1}-${r.id}`,
        issue: !r.executionAllowed ? "Execution blocked due to unsafe spread posture" : r.spreadStatus === "Critical" ? "Abnormal spread widening" : "Spread instability detected",
        affected: `${r.normalizedSymbol} · ${r.broker}`,
        severity: !r.executionAllowed || r.spreadStatus === "Critical" ? "Critical" : "Warning",
        rootCause: r.spreadDeviationPercent > 120 ? "Spread widened abruptly vs rolling average." : "Liquidity conditions deteriorated or broker spread widened.",
        tradingImpact: !r.executionAllowed ? "Unsafe execution path blocked." : "Execution cost deterioration increases slippage and invalidates strategy edges.",
        recommendedAction: !r.executionAllowed ? "Keep blocked and monitor until spreads normalize below warning." : "Compare peer brokers and reduce exposure.",
        autoBlockRecommendation: r.spreadStatus === "Critical" || r.spreadDeviationPercent > 120,
        confidenceScore: Math.min(96, Math.max(55, Math.round(100 - r.spreadStabilityScore)))
        })
      );
    return { meta: { timestamp: nowIso(), total: diagnostics.length }, diagnostics } satisfies AiDiagnosticsResponse;
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

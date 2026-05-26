import type {
  ActionResponse,
  AiDiagnosticsResponse,
  TradeLifecycleEvent,
  TradeModification,
  TradeReconciliationResponse,
  TradeSyncLogsResponse,
  TradeSyncSummaryResponse,
  TradeSyncTrade,
  TradeSyncTradesResponse
} from "../types/trade-synchronization.types";

import { useTradeSyncStore } from "../stores/trade-synchronization-store";

const BASE = "/api/mt5/trade-synchronization";

function roleHeaders(extra?: HeadersInit): HeadersInit {
  const role = useTradeSyncStore.getState().role;
  return { "x-nexus-role": role, ...(extra ?? {}) };
}

export async function fetchTradeSyncSummary() {
  const res = await fetch(`${BASE}/summary`, { cache: "no-store" });
  if (!res.ok) throw new Error(`summary ${res.status}`);
  return (await res.json()) as TradeSyncSummaryResponse;
}

export async function fetchTradeSyncTrades(params?: { search?: string; status?: string; page?: number; pageSize?: number }) {
  const url = new URL(`${BASE}/trades`, window.location.origin);
  if (params?.search) url.searchParams.set("search", params.search);
  if (params?.status) url.searchParams.set("status", params.status);
  if (params?.page) url.searchParams.set("page", String(params.page));
  if (params?.pageSize) url.searchParams.set("pageSize", String(params.pageSize));

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) throw new Error(`trades ${res.status}`);
  return (await res.json()) as TradeSyncTradesResponse;
}

export async function fetchTradeSyncTrade(tradeId: string) {
  const res = await fetch(`${BASE}/trades/${tradeId}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`trade ${res.status}`);
  return (await res.json()) as TradeSyncTrade;
}

export async function fetchTradeLifecycle(tradeId: string) {
  const res = await fetch(`${BASE}/trades/${tradeId}/lifecycle`, { cache: "no-store" });
  if (!res.ok) throw new Error(`lifecycle ${res.status}`);
  return (await res.json()) as TradeLifecycleEvent[];
}

export async function fetchTradeModifications(tradeId: string) {
  const res = await fetch(`${BASE}/trades/${tradeId}/modifications`, { cache: "no-store" });
  if (!res.ok) throw new Error(`mods ${res.status}`);
  return (await res.json()) as TradeModification[];
}

export async function fetchTradeReconciliation(tradeId?: string) {
  const res = await fetch(`${BASE}/reconciliation${tradeId ? `?tradeId=${tradeId}` : ""}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`recon ${res.status}`);
  return (await res.json()) as TradeReconciliationResponse;
}

export async function fetchTradeSyncLogs() {
  const res = await fetch(`${BASE}/logs`, { cache: "no-store" });
  if (!res.ok) throw new Error(`logs ${res.status}`);
  return (await res.json()) as TradeSyncLogsResponse;
}

export async function fetchTradeSyncExceptions(filter?: string) {
  const url = new URL(`${BASE}/exceptions`, typeof window !== "undefined" ? window.location.origin : "http://localhost");
  if (filter) url.searchParams.set("filter", filter);
  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) throw new Error(`exceptions ${res.status}`);
  return (await res.json()) as TradeSyncLogsResponse;
}

export async function fetchAiDiagnostics() {
  const res = await fetch(`${BASE}/ai-diagnostics`, { cache: "no-store" });
  if (!res.ok) throw new Error(`ai ${res.status}`);
  return (await res.json()) as AiDiagnosticsResponse;
}

export async function postTradeSync(tradeId: string) {
  const res = await fetch(`${BASE}/trades/${tradeId}/sync`, { method: "POST", headers: roleHeaders() });
  if (!res.ok) throw new Error(`sync ${res.status}`);
  return (await res.json()) as ActionResponse;
}

export async function postSyncAll() {
  const res = await fetch(`${BASE}/sync-all`, { method: "POST", headers: roleHeaders() });
  if (!res.ok) throw new Error(`sync-all ${res.status}`);
  return (await res.json()) as ActionResponse;
}

export async function postSyncSelected(tradeIds: string[]) {
  const res = await fetch(`${BASE}/sync-selected`, {
    method: "POST",
    headers: roleHeaders({ "content-type": "application/json" }),
    body: JSON.stringify({ tradeIds })
  });
  if (!res.ok) throw new Error(`sync-selected ${res.status}`);
  return (await res.json()) as ActionResponse;
}

export async function postTradeReconcile(tradeId: string) {
  const res = await fetch(`${BASE}/trades/${tradeId}/reconcile`, { method: "POST", headers: roleHeaders() });
  if (!res.ok) throw new Error(`reconcile ${res.status}`);
  return (await res.json()) as ActionResponse;
}

export async function postReconcileAll() {
  const res = await fetch(`${BASE}/reconcile-all`, { method: "POST", headers: roleHeaders() });
  if (!res.ok) throw new Error(`reconcile-all ${res.status}`);
  return (await res.json()) as ActionResponse;
}

export async function postAutoRemediate() {
  const res = await fetch(`${BASE}/auto-remediate`, { method: "POST", headers: roleHeaders() });
  if (!res.ok) throw new Error(`auto-remediate ${res.status}`);
  return (await res.json()) as ActionResponse;
}

export async function postEmergencyFreeze() {
  const res = await fetch(`${BASE}/emergency-freeze`, { method: "POST", headers: roleHeaders() });
  if (!res.ok) throw new Error(`freeze ${res.status}`);
  return (await res.json()) as ActionResponse;
}

export function mockAuditLog(event: { action: string; at: string; actor: string; context?: Record<string, unknown> }) {
  console.log("[audit]", event);
}

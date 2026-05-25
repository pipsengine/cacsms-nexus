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

import { getMockDiagnostics, getMockLifecycle, getMockLogs, getMockModifications, getMockTrades } from "../data/trade-synchronization.mock";
import { useTradeSyncStore } from "../stores/trade-synchronization-store";

const BASE = "/api/mt5/trade-synchronization";

function mockOnly() {
  return typeof window !== "undefined" && window.location.search.includes("mock=1");
}

function roleHeaders(extra?: HeadersInit): HeadersInit {
  const role = useTradeSyncStore.getState().role;
  return { "x-nexus-role": role, ...(extra ?? {}) };
}

export async function fetchTradeSyncSummary(options?: { allowMockFallback?: boolean }) {
  if (mockOnly()) {
    return (await fetchMockSummary()) satisfies TradeSyncSummaryResponse;
  }

  try {
    const res = await fetch(`${BASE}/summary`, { cache: "no-store" });
    if (!res.ok) throw new Error(`summary ${res.status}`);
    return (await res.json()) as TradeSyncSummaryResponse;
  } catch (e) {
    if (options?.allowMockFallback ?? true) {
      return fetchMockSummary();
    }
    throw e;
  }
}

export async function fetchTradeSyncTrades(params?: { search?: string; status?: string; page?: number; pageSize?: number }) {
  if (mockOnly()) {
    return fetchMockTrades(params);
  }

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
  if (mockOnly()) {
    const trade = getMockTrades().find((t) => t.tradeId === tradeId);
    if (!trade) throw new Error("trade not found");
    return trade;
  }

  const res = await fetch(`${BASE}/trades/${tradeId}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`trade ${res.status}`);
  return (await res.json()) as TradeSyncTrade;
}

export async function fetchTradeLifecycle(tradeId: string) {
  if (mockOnly()) {
    const trade = getMockTrades().find((t) => t.tradeId === tradeId) ?? null;
    return getMockLifecycle(tradeId, trade?.mt5Ticket ?? null);
  }
  const res = await fetch(`${BASE}/trades/${tradeId}/lifecycle`, { cache: "no-store" });
  if (!res.ok) throw new Error(`lifecycle ${res.status}`);
  return (await res.json()) as TradeLifecycleEvent[];
}

export async function fetchTradeModifications(tradeId: string) {
  if (mockOnly()) {
    const trade = getMockTrades().find((t) => t.tradeId === tradeId) ?? null;
    return getMockModifications(tradeId, trade?.mt5Ticket ?? null);
  }
  const res = await fetch(`${BASE}/trades/${tradeId}/modifications`, { cache: "no-store" });
  if (!res.ok) throw new Error(`mods ${res.status}`);
  return (await res.json()) as TradeModification[];
}

export async function fetchTradeReconciliation(tradeId?: string) {
  if (mockOnly()) {
    const trade = tradeId ? getMockTrades().find((t) => t.tradeId === tradeId) ?? null : null;
    if (!trade) {
      return { meta: { timestamp: new Date().toISOString() }, tradeId: tradeId ?? null, comparisons: [] } satisfies TradeReconciliationResponse;
    }
    return {
      meta: { timestamp: new Date().toISOString() },
      tradeId: trade.tradeId,
      comparisons: [
        {
          key: "state",
          label: "Trade state",
          nexusValue: trade.nexusState,
          mt5Value: trade.mt5State,
          difference: trade.nexusState === trade.mt5State ? "—" : `${trade.nexusState} vs ${trade.mt5State}`,
          status: trade.nexusState === trade.mt5State ? "Matched" : "Requires Review",
          requiredAction: trade.nexusState === trade.mt5State ? "None" : "Reconcile state and apply missing lifecycle events."
        },
        {
          key: "volume",
          label: "Volume",
          nexusValue: String(trade.volumeRequested),
          mt5Value: String(trade.volumeFilled),
          difference: `${trade.volumeFilled - trade.volumeRequested}`,
          status: trade.volumeFilled === trade.volumeRequested ? "Matched" : "Requires Review",
          requiredAction: trade.volumeFilled === trade.volumeRequested ? "None" : "Update partial fill lifecycle and exposure."
        },
        {
          key: "entryPrice",
          label: "Entry price",
          nexusValue: String(trade.entryPrice),
          mt5Value: String(trade.entryPrice),
          difference: "—",
          status: "Matched",
          requiredAction: "None"
        },
        {
          key: "stopLoss",
          label: "Stop loss",
          nexusValue: trade.stopLoss == null ? "—" : String(trade.stopLoss),
          mt5Value: trade.stopLoss == null ? "—" : String(trade.stopLoss),
          difference: "—",
          status: "Matched",
          requiredAction: "None"
        },
        {
          key: "takeProfit",
          label: "Take profit",
          nexusValue: trade.takeProfit == null ? "—" : String(trade.takeProfit),
          mt5Value: trade.takeProfit == null ? "—" : String(trade.takeProfit),
          difference: "—",
          status: "Matched",
          requiredAction: "None"
        },
        {
          key: "closePrice",
          label: "Close price",
          nexusValue: trade.closePrice == null ? "—" : String(trade.closePrice),
          mt5Value: trade.closePrice == null ? "—" : String(trade.closePrice),
          difference: "—",
          status: trade.mt5State === "CLOSED" && !trade.closeTime ? "Requires Review" : "Matched",
          requiredAction: trade.mt5State === "CLOSED" && !trade.closeTime ? "Capture missing close event and reconcile P/L." : "None"
        },
        {
          key: "profitLoss",
          label: "Profit/Loss",
          nexusValue: String(trade.netProfitLoss),
          mt5Value: String(trade.netProfitLoss),
          difference: "—",
          status: trade.tradeStatus === "Closed" ? "Matched" : "Requires Review",
          requiredAction: trade.tradeStatus === "Closed" ? "None" : "Reconcile after closure."
        },
        {
          key: "commissionSwap",
          label: "Commission + swap",
          nexusValue: String(trade.commission + trade.swap),
          mt5Value: String(trade.commission + trade.swap),
          difference: "—",
          status: "Matched",
          requiredAction: "None"
        },
        {
          key: "orderStatus",
          label: "Order status",
          nexusValue: trade.tradeStatus,
          mt5Value: trade.mt5State,
          difference: trade.tradeStatus === (trade.mt5State as any) ? "—" : `${trade.tradeStatus} vs ${trade.mt5State}`,
          status: trade.stateMatchStatus === "Matched" ? "Matched" : "Requires Review",
          requiredAction: trade.stateMatchStatus === "Matched" ? "None" : "Reconcile order status and ticket mapping."
        }
      ]
    } satisfies TradeReconciliationResponse;
  }
  const res = await fetch(`${BASE}/reconciliation${tradeId ? `?tradeId=${tradeId}` : ""}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`recon ${res.status}`);
  return (await res.json()) as TradeReconciliationResponse;
}

export async function fetchTradeSyncLogs() {
  if (mockOnly()) {
    return fetchMockLogs();
  }
  const res = await fetch(`${BASE}/logs`, { cache: "no-store" });
  if (!res.ok) throw new Error(`logs ${res.status}`);
  return (await res.json()) as TradeSyncLogsResponse;
}

export async function fetchTradeSyncExceptions(filter?: string) {
  if (mockOnly()) {
    const normalized = filter?.trim().toLowerCase() ?? "";
    const base = getMockLogs().filter((l) => l.resolutionStatus !== "Resolved");
    const logs = normalized
      ? base.filter(
          (l) =>
            l.exceptionType.toLowerCase().includes(normalized) ||
            l.severity.toLowerCase().includes(normalized) ||
            l.rootCause.toLowerCase().includes(normalized) ||
            l.errorMessage.toLowerCase().includes(normalized)
        )
      : base;
    return { meta: { timestamp: new Date().toISOString(), total: logs.length }, logs };
  }
  const url = new URL(`${BASE}/exceptions`, typeof window !== "undefined" ? window.location.origin : "http://localhost");
  if (filter) url.searchParams.set("filter", filter);
  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) throw new Error(`exceptions ${res.status}`);
  return (await res.json()) as TradeSyncLogsResponse;
}

export async function fetchAiDiagnostics() {
  if (mockOnly()) return getMockDiagnostics();
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

async function fetchMockSummary(): Promise<TradeSyncSummaryResponse> {
  const trades = getMockTrades();
  const totalActiveTrades = trades.filter((t) => t.tradeStatus === "Open" || t.tradeStatus === "Partially Filled").length;
  const syncedTrades = trades.filter((t) => t.syncStatus === "Synced").length;
  const pendingSync = trades.filter((t) => t.syncStatus === "Pending Sync").length;
  const failedSync = trades.filter((t) => t.syncStatus === "Failed Sync").length;
  const tradeStateMismatches = trades.filter((t) => t.stateMatchStatus !== "Matched").length;
  const openPositions = trades.filter((t) => t.tradeStatus === "Open" || t.tradeStatus === "Partially Filled").length;
  const pendingOrders = trades.filter((t) => t.tradeStatus === "Pending").length;
  const closedTradesToday = trades.filter((t) => t.tradeStatus === "Closed").length;
  const partialFills = trades.filter((t) => t.tradeStatus === "Partially Filled").length;
  const modificationEvents = 14;
  const averageSyncDelaySeconds = Math.round(trades.reduce((sum, t) => sum + t.syncDelaySeconds, 0) / trades.length);

  return {
    meta: { timestamp: new Date().toISOString(), environment: "Development", frozen: false },
    kpis: {
      totalActiveTrades,
      syncedTrades,
      pendingSync,
      failedSync,
      tradeStateMismatches,
      openPositions,
      pendingOrders,
      closedTradesToday,
      partialFills,
      modificationEvents,
      averageSyncDelaySeconds,
      tradeSyncHealthScore: { score: 78, explanation: "Healthy baseline with pending sync and a missing ticket exception.", factors: {}, penalties: {} }
    },
    workflow: []
  };
}

async function fetchMockTrades(params?: { search?: string; status?: string; page?: number; pageSize?: number }): Promise<TradeSyncTradesResponse> {
  const trades = getMockTrades();
  const search = params?.search?.trim().toLowerCase() ?? "";
  const status = params?.status ?? "all";

  const filtered = trades.filter((t) => {
    const matchesSearch =
      !search ||
      [t.tradeId, t.mt5Ticket ?? "", t.orderId ?? "", t.symbol, t.account, t.broker, t.terminal, t.syncStatus, t.tradeStatus].some((v) =>
        v.toLowerCase().includes(search)
      );
    const matchesStatus = status === "all" ? true : t.syncStatus === status || t.tradeStatus === status || t.stateMatchStatus === status;
    return matchesSearch && matchesStatus;
  });

  const page = params?.page ?? 1;
  const pageSize = params?.pageSize ?? 25;
  const start = (page - 1) * pageSize;
  const paged = filtered.slice(start, start + pageSize);

  return {
    meta: { timestamp: new Date().toISOString(), total: filtered.length, page, pageSize },
    trades: paged
  };
}

async function fetchMockLogs(): Promise<TradeSyncLogsResponse> {
  const logs = getMockLogs();
  return { meta: { timestamp: new Date().toISOString(), total: logs.length }, logs };
}

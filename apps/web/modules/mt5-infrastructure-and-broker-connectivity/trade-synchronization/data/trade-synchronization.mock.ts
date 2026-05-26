import type {
  AiDiagnosticsResponse,
  TradeLifecycleEvent,
  TradeModification,
  TradeSyncLogEntry,
  TradeSyncTrade
} from "../types/trade-synchronization.types";

function isoNow(offsetSeconds = 0) {
  return new Date(Date.now() + offsetSeconds * 1000).toISOString();
}

export function getMockTrades(): TradeSyncTrade[] {
  return [];
}

export function getMockLifecycle(_tradeId: string, _mt5Ticket: string | null): TradeLifecycleEvent[] {
  return [];
}

export function getMockModifications(_tradeId: string, _mt5Ticket: string | null): TradeModification[] {
  return [];
}

export function getMockLogs(): TradeSyncLogEntry[] {
  return [];
}

export function getMockDiagnostics(): AiDiagnosticsResponse {
  return { meta: { timestamp: isoNow() }, diagnostics: [] };
}

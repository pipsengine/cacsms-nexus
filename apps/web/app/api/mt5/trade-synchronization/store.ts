import { bindPersistedMt5State } from "@/app/api/mt5/_lib/persistence";
import { getMockTrades } from "@/modules/mt5-infrastructure-and-broker-connectivity/trade-synchronization/data/trade-synchronization.mock";
import type {
  TradeSyncLogEntry,
  TradeSyncTrade
} from "@/modules/mt5-infrastructure-and-broker-connectivity/trade-synchronization/types/trade-synchronization.types";

type TradeSyncRuntimeState = {
  frozen: boolean;
  trades: TradeSyncTrade[];
  logs: TradeSyncLogEntry[];
  updatedAt: string;
};

const state = bindPersistedMt5State<TradeSyncRuntimeState>("trade-synchronization", () => ({
  frozen: false,
  trades: getMockTrades(),
  logs: [],
  updatedAt: new Date().toISOString()
}));

export function getTradeSyncState() {
  return state;
}

export function setFrozen(frozen: boolean) {
  state.frozen = frozen;
  state.updatedAt = new Date().toISOString();
}

export function updateTrade(tradeId: string, patch: Partial<TradeSyncTrade>) {
  const index = state.trades.findIndex((t) => t.tradeId === tradeId);
  if (index < 0) {
    return null;
  }
  state.trades[index] = { ...state.trades[index], ...patch, lastNexusUpdateAt: new Date().toISOString() };
  state.updatedAt = new Date().toISOString();
  return state.trades[index];
}

export function listTrades() {
  return state.trades;
}

export function getTrade(tradeId: string) {
  return state.trades.find((t) => t.tradeId === tradeId) ?? null;
}

export function appendTradeSyncLog(entry: Omit<TradeSyncLogEntry, "id">) {
  const id = `audit_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const next: TradeSyncLogEntry = { id, ...entry };
  state.logs = [next, ...state.logs].slice(0, 250);
  state.updatedAt = new Date().toISOString();
  return next;
}

export function listRuntimeLogs() {
  return state.logs;
}

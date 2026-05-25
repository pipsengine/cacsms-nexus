import type { TradeSyncTrade } from "../types/trade-synchronization.types";

export function formatUsd(value: number, maximumFractionDigits = 2) {
  return value.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits });
}

export function formatNumber(value: number, maximumFractionDigits = 2) {
  return value.toLocaleString(undefined, { maximumFractionDigits });
}

export function formatSeconds(value: number) {
  if (!Number.isFinite(value)) {
    return "—";
  }
  if (value < 60) {
    return `${Math.round(value)}s`;
  }
  const minutes = Math.floor(value / 60);
  const seconds = Math.round(value % 60);
  return `${minutes}m ${seconds}s`;
}

export type TradeSyncTableRow = TradeSyncTrade & {
  stateMatch: "Match" | "Mismatch";
};

export function toTableRow(trade: TradeSyncTrade): TradeSyncTableRow {
  return {
    ...trade,
    stateMatch: trade.stateMatchStatus === "Matched" ? "Match" : "Mismatch"
  };
}

export function textIncludes(haystack: string, needle: string) {
  const n = needle.trim().toLowerCase();
  if (!n) return true;
  return haystack.toLowerCase().includes(n);
}


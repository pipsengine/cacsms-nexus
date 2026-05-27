import { normalizeBrokerSymbol } from "@/modules/mt5-infrastructure-and-broker-connectivity/symbol-sync/algorithms/symbol-sync.algorithms";

export type LiveQuoteInput = {
  brokerId: string;
  brokerName: string;
  accountId: string;
  accountLogin: string;
  serverName?: string;
  symbol?: string;
  bid?: number;
  ask?: number;
  marketDataActive: boolean;
  tradingEnabled: boolean;
  latencyMs: number;
  receivedAt: string;
};

export function hasLivePrices(input: Pick<LiveQuoteInput, "bid" | "ask">) {
  return Number.isFinite(input.bid) && Number.isFinite(input.ask) && (input.bid ?? 0) > 0 && (input.ask ?? 0) > 0;
}

export function quoteSymbolKey(brokerId: string, symbol: string) {
  return `${brokerId}:${symbol.trim()}`.toLowerCase();
}

export function inferDigits(bid: number, ask: number) {
  const spread = Math.abs(ask - bid);
  if (spread >= 1) return 1;
  if (spread >= 0.1) return 2;
  if (spread >= 0.01) return 3;
  return 5;
}

export function inferContractSize(normalizedSymbol: string) {
  const upper = normalizedSymbol.toUpperCase();
  if (upper.includes("XAU") || upper.includes("GOLD")) return 100;
  if (/^(US30|NAS100|SPX500|UK100|DE40)/.test(upper)) return 1;
  return 100_000;
}

export function resolveNormalizedQuote(symbol: string) {
  return normalizeBrokerSymbol(symbol);
}

export function spreadMonitorMeta(normalizedSymbol: string) {
  const upper = normalizedSymbol.toUpperCase();
  if (upper === "USDJPY") return { digits: 3, pipSize: 0.01, pointValue: 10, contractSize: 100_000, assetClass: "Forex" as const };
  if (upper === "XAUUSD") return { digits: 2, pipSize: 0.1, pointValue: 1, contractSize: 100, assetClass: "Metals" as const };
  if (/^(NAS100|SPX500|US30|UK100|DE40)/.test(upper)) return { digits: 1, pipSize: 1, pointValue: 1, contractSize: 1, assetClass: "Indices" as const };
  return { digits: 5, pipSize: 0.0001, pointValue: 10, contractSize: 100_000, assetClass: "Forex" as const };
}

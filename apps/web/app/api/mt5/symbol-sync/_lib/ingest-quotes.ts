import { classifyFeed, normalizeBrokerSymbol } from "@/modules/mt5-infrastructure-and-broker-connectivity/symbol-sync/algorithms/symbol-sync.algorithms";
import type { SyncedSymbol } from "@/modules/mt5-infrastructure-and-broker-connectivity/symbol-sync/types/symbol-sync.types";
import { hasLivePrices, inferContractSize, inferDigits, type LiveQuoteInput, quoteSymbolKey } from "../../_lib/quote-ingest-shared";

type SymbolSyncQuoteState = {
  symbols: SyncedSymbol[];
  lastSyncAt: string;
};

function createSyncedSymbol(input: LiveQuoteInput & { brokerSymbol: string }): SyncedSymbol {
  const normalized = normalizeBrokerSymbol(input.brokerSymbol);
  const spread = hasLivePrices(input) ? Number((input.ask! - input.bid!).toFixed(6)) : 0;
  const digits = hasLivePrices(input) ? inferDigits(input.bid!, input.ask!) : 5;
  const tickSize = digits >= 3 ? 10 ** -digits : 0.01;
  return {
    id: `symbol-${quoteSymbolKey(input.brokerId, input.brokerSymbol)}`.replace(/[^a-z0-9-]/g, "-"),
    brokerId: input.brokerId,
    brokerName: input.brokerName,
    serverName: input.serverName ?? input.brokerName,
    brokerSymbol: input.brokerSymbol,
    normalizedSymbol: normalized.normalizedSymbol,
    assetClass: normalized.assetClass,
    digits,
    contractSize: inferContractSize(normalized.normalizedSymbol),
    tickSize,
    tickValue: 1,
    minLot: 0.01,
    maxLot: 100,
    lotStep: 0.01,
    spread,
    rollingSpread: spread > 0 ? spread : 0.3,
    tradingAllowed: input.tradingEnabled && normalized.known,
    dataFeedActive: input.marketDataActive && hasLivePrices(input),
    marketOpen: true,
    mappingStatus: normalized.known ? "Healthy" : "Critical",
    feedStatus: "Healthy",
    lastTickAt: input.receivedAt,
    lastSyncAt: input.receivedAt,
    tickDelaySeconds: 0,
    gapCount: 0,
    riskLevel: "Healthy",
    mismatchReason: normalized.known ? undefined : "Instrument is not present in the internal registry."
  };
}

export function ingestLiveQuoteFromHeartbeat(state: SymbolSyncQuoteState, input: LiveQuoteInput) {
  if (!input.symbol?.trim()) {
    state.lastSyncAt = input.receivedAt;
    return null;
  }

  const brokerSymbol = input.symbol.trim();
  const key = quoteSymbolKey(input.brokerId, brokerSymbol);
  let symbol =
    state.symbols.find((item) => quoteSymbolKey(item.brokerId, item.brokerSymbol) === key) ??
    state.symbols.find((item) => item.brokerSymbol === brokerSymbol && item.brokerName === input.brokerName);

  if (!symbol && hasLivePrices(input)) {
    symbol = createSyncedSymbol({ ...input, brokerSymbol });
    state.symbols.unshift(symbol);
  }

  if (!symbol) {
    state.lastSyncAt = input.receivedAt;
    return null;
  }

  if (hasLivePrices(input)) {
    const spread = Number((input.ask! - input.bid!).toFixed(6));
    symbol.spread = spread;
    symbol.rollingSpread = symbol.rollingSpread > 0 ? symbol.rollingSpread * 0.92 + spread * 0.08 : spread;
    symbol.digits = inferDigits(input.bid!, input.ask!);
  }

  symbol.lastTickAt = input.receivedAt;
  symbol.lastSyncAt = input.receivedAt;
  symbol.dataFeedActive = input.marketDataActive && hasLivePrices(input);
  symbol.marketOpen = true;
  symbol.tradingAllowed = input.tradingEnabled && normalizeBrokerSymbol(symbol.brokerSymbol).known;
  symbol.feedStatus = classifyFeed(symbol);
  symbol.mappingStatus = normalizeBrokerSymbol(symbol.brokerSymbol).known ? (symbol.dataFeedActive ? "Healthy" : "Critical") : "Critical";
  symbol.riskLevel = symbol.mappingStatus === "Critical" || symbol.feedStatus === "Offline" ? "Critical" : symbol.feedStatus === "Degraded" ? "Degraded" : "Healthy";
  state.lastSyncAt = input.receivedAt;
  return symbol;
}

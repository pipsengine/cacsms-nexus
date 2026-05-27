import type { MarketInstrument } from "@/modules/mt5-infrastructure-and-broker-connectivity/market-watch/types/market-watch.types";

type MarketWatchQuoteState = {
  instruments: MarketInstrument[];
  lastRefreshAt: string;
};

function assetClassForSymbol(symbol: string): MarketInstrument["assetClass"] {
  const upper = symbol.toUpperCase();
  if (upper.includes("XAU") || upper.includes("GOLD")) return "Metal";
  if (upper.includes("BTC") || upper.includes("ETH")) return "Crypto";
  if (/^(US30|NAS100|SPX500|UK100|DE40)/.test(upper)) return "Index";
  if (upper.includes("WTI") || upper.includes("BRENT") || upper.includes("OIL")) return "Energy";
  return "Forex";
}

function createInstrumentFromQuote(input: {
  brokerName: string;
  symbol: string;
  bid: number;
  ask: number;
  latencyMs: number;
  receivedAt: string;
  feedActive: boolean;
}): MarketInstrument {
  const spreadPoints = Math.max(0, Math.round((input.ask - input.bid) * 100_000));
  return {
    id: `mw-${input.brokerName}-${input.symbol}`.toLowerCase().replace(/\s+/g, "-"),
    symbol: input.symbol,
    description: input.symbol,
    assetClass: assetClassForSymbol(input.symbol),
    brokerName: input.brokerName,
    bid: input.bid,
    ask: input.ask,
    digits: spreadPoints > 100 ? 2 : 5,
    point: spreadPoints > 100 ? 0.01 : 0.00001,
    dailyOpen: input.bid,
    dailyHigh: Math.max(input.bid, input.ask),
    dailyLow: Math.min(input.bid, input.ask),
    volume: 0,
    volatilityPercent: 0,
    spreadBaselinePoints: Math.max(spreadPoints, 1),
    latencyMs: input.latencyMs,
    session: "Live",
    marketOpen: true,
    lastTickAt: input.receivedAt,
    feedActive: input.feedActive,
    watchlisted: true,
    tradeEnabled: true,
    trend: [input.bid, input.ask, input.bid]
  };
}

export function ingestLiveQuoteFromHeartbeat(
  state: MarketWatchQuoteState,
  input: {
    brokerName: string;
    symbol?: string;
    bid?: number;
    ask?: number;
    marketDataActive: boolean;
    latencyMs: number;
    receivedAt: string;
  }
) {
  if (!input.symbol?.trim()) {
    if (input.marketDataActive) state.lastRefreshAt = input.receivedAt;
    return null;
  }

  const symbol = input.symbol.trim();
  const hasPrices = Number.isFinite(input.bid) && Number.isFinite(input.ask) && (input.bid ?? 0) > 0 && (input.ask ?? 0) > 0;
  let instrument =
    state.instruments.find((item) => item.symbol === symbol && item.brokerName === input.brokerName) ??
    state.instruments.find((item) => item.symbol === symbol);

  if (!instrument && hasPrices) {
    instrument = createInstrumentFromQuote({
      brokerName: input.brokerName,
      symbol,
      bid: input.bid!,
      ask: input.ask!,
      latencyMs: input.latencyMs,
      receivedAt: input.receivedAt,
      feedActive: input.marketDataActive
    });
    state.instruments.unshift(instrument);
  }

  if (!instrument) {
    state.lastRefreshAt = input.receivedAt;
    return null;
  }

  if (hasPrices) {
    const previousBid = instrument.bid;
    instrument.bid = input.bid!;
    instrument.ask = input.ask!;
    instrument.dailyHigh = Math.max(instrument.dailyHigh, instrument.bid, instrument.ask);
    instrument.dailyLow = Math.min(instrument.dailyLow, instrument.bid, instrument.ask);
    instrument.trend = [...instrument.trend.slice(-8), instrument.bid];
    if (instrument.dailyOpen <= 0) instrument.dailyOpen = previousBid > 0 ? previousBid : instrument.bid;
  }

  instrument.lastTickAt = input.receivedAt;
  instrument.feedActive = input.marketDataActive;
  instrument.latencyMs = input.latencyMs;
  instrument.marketOpen = input.marketDataActive;
  state.lastRefreshAt = input.receivedAt;
  return instrument;
}

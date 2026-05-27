import type { Candle, ChartInstrument, ChartLayout, Timeframe } from "@/modules/mt5-infrastructure-and-broker-connectivity/chart-control/types/chart-control.types";
import { hasLivePrices, inferDigits, resolveNormalizedQuote, type LiveQuoteInput, quoteSymbolKey } from "../../_lib/quote-ingest-shared";

type ChartControlQuoteState = {
  instruments: ChartInstrument[];
  layouts: ChartLayout[];
  lastRefreshAt: string;
};

const defaultTimeframe: Timeframe = "M15";

function assetClassForSymbol(normalizedSymbol: string): string {
  const meta = resolveNormalizedQuote(normalizedSymbol);
  return meta.assetClass;
}

function seedCandle(bid: number, ask: number, receivedAt: string, digits: number): Candle[] {
  const close = bid;
  const open = Number((bid - (ask - bid) * 0.2).toFixed(digits));
  const high = Number(Math.max(open, ask).toFixed(digits));
  const low = Number(Math.min(open, bid).toFixed(digits));
  return [{ timestamp: receivedAt, open, high, low, close, volume: 1, sma20: close, ema9: close, rsi: 50 }];
}

function appendTick(candles: Candle[], bid: number, ask: number, receivedAt: string, digits: number) {
  if (!candles.length) return seedCandle(bid, ask, receivedAt, digits);
  const last = candles[candles.length - 1]!;
  const close = Number(bid.toFixed(digits));
  const updated: Candle = {
    ...last,
    timestamp: receivedAt,
    close,
    high: Number(Math.max(last.high, ask).toFixed(digits)),
    low: Number(Math.min(last.low, bid).toFixed(digits)),
    ema9: Number(((last.ema9 * 8 + close) / 9).toFixed(digits)),
    rsi: Math.max(20, Math.min(80, last.rsi + (close >= last.close ? 1 : -1)))
  };
  return [...candles.slice(-23), updated];
}

function ensureActiveLayout(state: ChartControlQuoteState, instrument: ChartInstrument, receivedAt: string) {
  let layout = state.layouts.find((entry) => entry.active);
  if (!layout) {
    layout = {
      id: "layout-live",
      name: "Live Workspace",
      slots: 1,
      instruments: [instrument.symbol],
      timeframes: [instrument.timeframe],
      indicators: ["EMA 9", "RSI 14"],
      active: true,
      updatedAt: receivedAt
    };
    state.layouts.unshift(layout);
    return;
  }
  if (!layout.instruments.includes(instrument.symbol)) {
    layout.instruments = [...layout.instruments, instrument.symbol].slice(0, layout.slots);
    layout.timeframes = [...layout.timeframes, instrument.timeframe].slice(0, layout.slots);
    layout.updatedAt = receivedAt;
  }
}

function createInstrument(input: LiveQuoteInput & { brokerSymbol: string }): ChartInstrument {
  const normalized = resolveNormalizedQuote(input.brokerSymbol);
  const digits = hasLivePrices(input) ? inferDigits(input.bid!, input.ask!) : 5;
  const spreadPoints = hasLivePrices(input) ? Math.max(1, Math.round((input.ask! - input.bid!) * 10 ** digits)) : 0;
  return {
    id: `chart-${quoteSymbolKey(input.brokerId, input.brokerSymbol)}`.replace(/[^a-z0-9-]/g, "-"),
    symbol: normalized.normalizedSymbol,
    description: `${normalized.normalizedSymbol} live chart`,
    assetClass: assetClassForSymbol(normalized.normalizedSymbol),
    brokerName: input.brokerName,
    digits,
    timeframe: defaultTimeframe,
    availableTimeframes: ["M1", "M5", "M15", "H1", "H4", "D1"],
    bid: input.bid ?? 0,
    ask: input.ask ?? 0,
    spreadPoints,
    lastTickAt: input.receivedAt,
    feedStatus: input.marketDataActive && hasLivePrices(input) ? "Healthy" : "Offline",
    tradeEnabled: input.tradingEnabled,
    candles: hasLivePrices(input) ? seedCandle(input.bid!, input.ask!, input.receivedAt, digits) : [],
    visibleIndicators: ["EMA 9", "RSI 14"]
  };
}

export function ingestLiveQuoteFromHeartbeat(state: ChartControlQuoteState, input: LiveQuoteInput) {
  if (!input.symbol?.trim()) {
    state.lastRefreshAt = input.receivedAt;
    return null;
  }

  const brokerSymbol = input.symbol.trim();
  const key = quoteSymbolKey(input.brokerId, brokerSymbol);
  let instrument =
    state.instruments.find((item) => item.id.includes(key.replace(/:/g, "-"))) ??
    state.instruments.find((item) => item.symbol === resolveNormalizedQuote(brokerSymbol).normalizedSymbol && item.brokerName === input.brokerName);

  if (!instrument && hasLivePrices(input)) {
    instrument = createInstrument({ ...input, brokerSymbol });
    state.instruments.unshift(instrument);
    ensureActiveLayout(state, instrument, input.receivedAt);
  }

  if (!instrument) {
    state.lastRefreshAt = input.receivedAt;
    return null;
  }

  if (hasLivePrices(input)) {
    instrument.bid = input.bid!;
    instrument.ask = input.ask!;
    instrument.spreadPoints = Math.max(1, Math.round((input.ask! - input.bid!) * 10 ** instrument.digits));
    instrument.candles = appendTick(instrument.candles, input.bid!, input.ask!, input.receivedAt, instrument.digits);
  }

  instrument.lastTickAt = input.receivedAt;
  instrument.feedStatus = input.marketDataActive && hasLivePrices(input) ? "Healthy" : "Offline";
  instrument.tradeEnabled = input.tradingEnabled;
  state.lastRefreshAt = input.receivedAt;
  ensureActiveLayout(state, instrument, input.receivedAt);
  return instrument;
}

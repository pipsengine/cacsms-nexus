import type { Candle, ChartInstrument, ChartLayout, ChartSignal, ChartSnapshot, DrawingObject, Timeframe } from "@/modules/mt5-infrastructure-and-broker-connectivity/chart-control/types/chart-control.types";

const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

function candles(base: number, movement: number, digits: number, volatility: number): Candle[] {
  return Array.from({ length: 24 }, (_, index) => {
    const drift = movement * (index / 23);
    const wave = Math.sin(index * 1.34) * volatility;
    const close = Number((base + drift + wave).toFixed(digits));
    const open = Number((base + movement * (Math.max(0, index - 1) / 23) + Math.sin((index - 1) * 1.34) * volatility).toFixed(digits));
    const high = Number((Math.max(open, close) + volatility * 0.7).toFixed(digits));
    const low = Number((Math.min(open, close) - volatility * 0.65).toFixed(digits));
    const sma20 = Number((base + movement * Math.max(0, index - 4) / 23).toFixed(digits));
    const ema9 = Number((base + movement * Math.max(0, index - 2) / 23 + wave * 0.42).toFixed(digits));
    return { timestamp: ago((23 - index) * 15), open, high, low, close, volume: Math.round(820 + Math.abs(wave / volatility) * 670 + index * 18), sma20, ema9, rsi: Math.round(48 + movement / Math.max(volatility, 0.00001) * 2 + Math.sin(index) * 8) };
  });
}

export function createChartControlSeed() {
  const instruments: ChartInstrument[] = [
    { id: "chart-eurusd", symbol: "EURUSD", description: "Euro / US Dollar", assetClass: "Forex", brokerName: "IC Markets", digits: 5, timeframe: "M15", availableTimeframes: ["M1", "M5", "M15", "H1", "H4", "D1"], bid: 1.08462, ask: 1.08464, spreadPoints: 2, lastTickAt: ago(0), feedStatus: "Healthy", tradeEnabled: true, candles: candles(1.0822, 0.00245, 5, 0.00023), visibleIndicators: ["EMA 9", "SMA 20", "RSI 14"] },
    { id: "chart-xauusd", symbol: "XAUUSD", description: "Gold Spot / US Dollar", assetClass: "Metal", brokerName: "IC Markets", digits: 2, timeframe: "H1", availableTimeframes: ["M5", "M15", "H1", "H4", "D1"], bid: 2384.18, ask: 2384.42, spreadPoints: 24, lastTickAt: ago(0), feedStatus: "Healthy", tradeEnabled: true, candles: candles(2367.8, 16.5, 2, 3.2), visibleIndicators: ["EMA 9", "SMA 20", "ATR 14", "Volume"] },
    { id: "chart-nas100", symbol: "NAS100", description: "Nasdaq 100 Cash", assetClass: "Index", brokerName: "FTMO", digits: 1, timeframe: "M15", availableTimeframes: ["M1", "M5", "M15", "H1", "H4"], bid: 18854.1, ask: 18862.9, spreadPoints: 88, lastTickAt: ago(3), feedStatus: "Offline", tradeEnabled: false, candles: candles(18705.2, 150.4, 1, 34.5), visibleIndicators: ["EMA 9", "RSI 14", "Volume"] },
    { id: "chart-gbpusd", symbol: "GBPUSD", description: "British Pound / US Dollar", assetClass: "Forex", brokerName: "Pepperstone", digits: 5, timeframe: "H1", availableTimeframes: ["M5", "M15", "H1", "H4", "D1"], bid: 1.27491, ask: 1.27495, spreadPoints: 4, lastTickAt: ago(0), feedStatus: "Healthy", tradeEnabled: true, candles: candles(1.2711, 0.0038, 5, 0.00041), visibleIndicators: ["EMA 9", "Bollinger Bands"] }
  ];
  const layouts: ChartLayout[] = [
    { id: "layout-trading", name: "Execution Workspace", slots: 4, instruments: ["EURUSD", "XAUUSD", "NAS100", "GBPUSD"], timeframes: ["M15", "H1", "M15", "H1"], indicators: ["EMA 9", "SMA 20", "RSI 14", "Volume"], active: true, updatedAt: ago(12) },
    { id: "layout-scalp", name: "Intraday Liquidity", slots: 2, instruments: ["EURUSD", "XAUUSD"], timeframes: ["M5", "M5"], indicators: ["VWAP", "EMA 9", "Volume"], active: false, updatedAt: ago(48) },
    { id: "layout-risk", name: "Risk Review", slots: 3, instruments: ["NAS100", "XAUUSD", "GBPUSD"], timeframes: ["H1", "H4", "H1"], indicators: ["ATR 14", "RSI 14", "SMA 20"], active: false, updatedAt: ago(90) }
  ];
  const drawings: DrawingObject[] = [
    { id: "drawing-1", instrumentId: "chart-nas100", label: "Resistance rejection", kind: "Horizontal Level", price: 18890.2, color: "red", visible: true },
    { id: "drawing-2", instrumentId: "chart-nas100", label: "Blocked execution zone", kind: "Risk Zone", price: 18854.1, color: "orange", visible: true },
    { id: "drawing-3", instrumentId: "chart-xauusd", label: "London breakout", kind: "Trendline", price: 2378.4, color: "blue", visible: true },
    { id: "drawing-4", instrumentId: "chart-eurusd", label: "Demand support", kind: "Horizontal Level", price: 1.0821, color: "green", visible: true }
  ];
  const signals: ChartSignal[] = [
    { id: "signal-nas-feed", instrumentId: "chart-nas100", symbol: "NAS100", signalType: "Data Quality", direction: "Neutral", severity: "Critical", timeframe: "M15", detail: "Chart halted on stale broker quotes; execution remains disabled.", confidenceScore: 0.99, detectedAt: ago(3) },
    { id: "signal-xau-breakout", instrumentId: "chart-xauusd", symbol: "XAUUSD", signalType: "Breakout", direction: "Bullish", severity: "Warning", timeframe: "H1", detail: "Price extended above intraday resistance with elevated volume.", confidenceScore: 0.86, detectedAt: ago(14) },
    { id: "signal-eur-trend", instrumentId: "chart-eurusd", symbol: "EURUSD", signalType: "Trend Shift", direction: "Bullish", severity: "Info", timeframe: "M15", detail: "EMA 9 crossed above SMA 20 with stable spread delivery.", confidenceScore: 0.82, detectedAt: ago(18) }
  ];
  const snapshots: ChartSnapshot[] = [
    { id: "snapshot-1", symbol: "NAS100", timeframe: "M15", layoutName: "Execution Workspace", capturedBy: "autonomous-monitor", capturedAt: ago(3), note: "Feed degradation and execution block captured." },
    { id: "snapshot-2", symbol: "XAUUSD", timeframe: "H1", layoutName: "Execution Workspace", capturedBy: "risk-manager", capturedAt: ago(17), note: "Breakout review requested." }
  ];
  return { instruments, layouts, drawings, signals, snapshots };
}

export const timeframes: Timeframe[] = ["M1", "M5", "M15", "H1", "H4", "D1"];

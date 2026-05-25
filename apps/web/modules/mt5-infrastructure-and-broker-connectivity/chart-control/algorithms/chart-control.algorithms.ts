import type { Candle, ChartAnalysis, ChartInstrument, ChartTone, Timeframe } from "../types/chart-control.types";

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));
const timeframeWindow: Record<Timeframe, number> = { M1: 8, M5: 12, M15: 16, H1: 20, H4: 22, D1: 24 };

export function visibleCandles(candles: Candle[], timeframe: Timeframe) {
  return candles.slice(-timeframeWindow[timeframe]);
}

export function analyzeChart(instrument: ChartInstrument, timeframe = instrument.timeframe): ChartAnalysis {
  const candles = visibleCandles(instrument.candles, timeframe);
  const first = candles[0].close;
  const latest = candles.at(-1)!;
  const changePercent = Number((((latest.close - first) / first) * 100).toFixed(2));
  const support = Math.min(...candles.map((candle) => candle.low));
  const resistance = Math.max(...candles.map((candle) => candle.high));
  const averageVolume = Math.round(candles.reduce((sum, candle) => sum + candle.volume, 0) / candles.length);
  const volatilityPercent = Number((((resistance - support) / latest.close) * 100).toFixed(2));
  const trend = changePercent > 0.08 ? "Bullish" : changePercent < -0.08 ? "Bearish" : "Range";
  return { trend, changePercent, rsi: latest.rsi, support, resistance, averageVolume, volatilityPercent, status: chartStatus(instrument) };
}

export function chartStatus(instrument: ChartInstrument): ChartTone {
  if (instrument.feedStatus === "Offline") return "Offline";
  if (!instrument.tradeEnabled) return "Critical";
  if (instrument.spreadPoints > 50) return "Degraded";
  const analysis = analyzeWithoutStatus(instrument);
  return analysis.volatilityPercent > 2.5 ? "Watch" : "Healthy";
}

function analyzeWithoutStatus(instrument: ChartInstrument) {
  const candles = visibleCandles(instrument.candles, instrument.timeframe);
  const last = candles.at(-1)!;
  const support = Math.min(...candles.map((candle) => candle.low));
  const resistance = Math.max(...candles.map((candle) => candle.high));
  return { volatilityPercent: Number((((resistance - support) / last.close) * 100).toFixed(2)) };
}

export function calculateWorkspaceHealth(instruments: ChartInstrument[]) {
  const total = instruments.length || 1;
  const factors = {
    feeds: instruments.filter((instrument) => instrument.feedStatus === "Healthy").length / total * 35,
    execution: instruments.filter((instrument) => instrument.tradeEnabled).length / total * 25,
    spreads: instruments.filter((instrument) => instrument.spreadPoints <= 50).length / total * 20,
    signals: instruments.filter((instrument) => chartStatus(instrument) === "Healthy" || chartStatus(instrument) === "Watch").length / total * 20
  };
  const score = clamp(Object.values(factors).reduce((sum, factor) => sum + factor, 0));
  return { score, status: score >= 80 ? "Healthy" as ChartTone : score >= 60 ? "Degraded" as ChartTone : "Critical" as ChartTone, factors };
}

export function indicatorRecommendation(analysis: ChartAnalysis) {
  if (analysis.status === "Offline") return "Freeze trading overlays until fresh ticks resume.";
  if (analysis.rsi > 70) return "Momentum is extended; confirm continuation before entry.";
  if (analysis.rsi < 30) return "Oversold momentum detected; watch for reversal confirmation.";
  if (analysis.trend === "Bullish") return "Bullish structure is active above support.";
  if (analysis.trend === "Bearish") return "Bearish structure is active below resistance.";
  return "Range conditions detected; monitor boundary breaks.";
}

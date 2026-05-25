import type { MarketAlert, MarketHealth, MarketInstrument, MarketTone } from "../types/market-watch.types";

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));
const rating = (score: number): MarketHealth["rating"] => score >= 90 ? "Excellent" : score >= 75 ? "Healthy" : score >= 60 ? "Degraded" : score >= 40 ? "High Risk" : "Critical";

export function spreadPoints(instrument: MarketInstrument) {
  return Math.round((instrument.ask - instrument.bid) / instrument.point);
}

export function dailyMovePercent(instrument: MarketInstrument) {
  return Number((((instrument.bid - instrument.dailyOpen) / instrument.dailyOpen) * 100).toFixed(2));
}

export function quoteStatus(instrument: MarketInstrument, now = Date.now()): MarketTone {
  if (!instrument.marketOpen) return "Inactive";
  if (!instrument.feedActive) return "Offline";
  const ageSeconds = (now - new Date(instrument.lastTickAt).getTime()) / 1000;
  if (ageSeconds > 60) return "Critical";
  if (ageSeconds > 15 || spreadPoints(instrument) > instrument.spreadBaselinePoints * 2) return "Degraded";
  if (instrument.volatilityPercent > 2.5) return "Watch";
  return "Healthy";
}

export function detectMarketAlerts(instruments: MarketInstrument[], now = Date.now()) {
  const alerts: MarketAlert[] = [];
  const add = (instrument: MarketInstrument, alertType: MarketAlert["alertType"], severity: MarketAlert["severity"], detail: string, recommendation: string) =>
    alerts.push({ id: `${instrument.id}-${alertType.toLowerCase().replace(/\s+/g, "-")}`, instrumentId: instrument.id, symbol: instrument.symbol, alertType, severity, detail, recommendation, detectedAt: new Date(now).toISOString() });
  instruments.forEach((instrument) => {
    const spread = spreadPoints(instrument);
    const ageSeconds = (now - new Date(instrument.lastTickAt).getTime()) / 1000;
    if (instrument.marketOpen && !instrument.feedActive) add(instrument, "Feed Offline", "Critical", "No active ticks are arriving for an open instrument.", "Keep routing disabled and restore broker connectivity.");
    else if (instrument.marketOpen && ageSeconds > 15) add(instrument, "Stale Quote", ageSeconds > 60 ? "Critical" : "Warning", `Latest tick is ${Math.round(ageSeconds)} seconds old.`, "Confirm stream freshness before entering a position.");
    if (spread > instrument.spreadBaselinePoints * 2) add(instrument, "Spread Expansion", spread > instrument.spreadBaselinePoints * 3 ? "Critical" : "Warning", `${spread} points versus ${instrument.spreadBaselinePoints} point baseline.`, "Pause price-sensitive routing until liquidity recovers.");
    if (instrument.volatilityPercent > 2.5) add(instrument, "Volatility Surge", "Warning", `${instrument.volatilityPercent}% intraday volatility exceeds monitoring threshold.`, "Apply tighter risk sizing and monitor market regime.");
    if (!instrument.tradeEnabled) add(instrument, "Trading Restricted", "Critical", "Execution permission is blocked for this instrument.", "Retain block until quote and broker checks pass.");
  });
  return alerts;
}

export function calculateMarketHealth(instruments: MarketInstrument[], now = Date.now()): MarketHealth {
  const total = instruments.length || 1;
  const statuses = instruments.map((instrument) => quoteStatus(instrument, now));
  const alerts = detectMarketAlerts(instruments, now);
  const factors = {
    liveFeeds: instruments.filter((instrument) => instrument.feedActive).length / total * 30,
    freshQuotes: statuses.filter((status) => status === "Healthy" || status === "Watch").length / total * 25,
    stableSpreads: instruments.filter((instrument) => spreadPoints(instrument) <= instrument.spreadBaselinePoints * 2).length / total * 20,
    executable: instruments.filter((instrument) => instrument.tradeEnabled).length / total * 15,
    latency: instruments.filter((instrument) => instrument.latencyMs < 150).length / total * 10,
    criticalPenalty: -alerts.filter((alert) => alert.severity === "Critical").length * 5
  };
  const score = clamp(Object.values(factors).reduce((sum, factor) => sum + factor, 0));
  return { score, rating: rating(score), factors };
}

export function topMarketMovers(instruments: MarketInstrument[], count = 4) {
  return [...instruments].sort((left, right) => Math.abs(dailyMovePercent(right)) - Math.abs(dailyMovePercent(left))).slice(0, count);
}

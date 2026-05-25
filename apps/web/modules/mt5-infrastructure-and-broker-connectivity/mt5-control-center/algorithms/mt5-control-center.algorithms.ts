import type { Broker, ExecutionSample, ScoreResult, SymbolMapping, Terminal } from "../types/mt5-control-center.types";

const registry: Record<string, string> = {
  EURUSD: "Forex Major",
  GBPUSD: "Forex Major",
  USDJPY: "Forex Major",
  EURGBP: "Forex Cross",
  EURJPY: "Forex Cross",
  XAUUSD: "Metal",
  GOLD: "Metal",
  NAS100: "Index",
  NASDAQ: "Index",
  SPX500: "Index",
  US30: "Index"
};

function clamp(score: number) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function rating(score: number): ScoreResult["rating"] {
  if (score >= 90) return "Excellent";
  if (score >= 75) return "Healthy";
  if (score >= 60) return "Degraded";
  if (score >= 40) return "High Risk";
  return "Critical";
}

export function calculateConnectionHealthScore(input: {
  uptimePercent: number;
  heartbeatAgeSeconds: number;
  latencyMs: number;
  dataFeedQuality: number;
  loginSuccessPercent: number;
  executionSuccessPercent: number;
  criticalIncidents: number;
}): ScoreResult {
  const factors = {
    uptime: Math.min(20, input.uptimePercent * 0.2),
    heartbeat: input.heartbeatAgeSeconds <= 15 ? 20 : input.heartbeatAgeSeconds <= 60 ? 10 : 0,
    latency: input.latencyMs <= 100 ? 15 : input.latencyMs <= 250 ? 10 : input.latencyMs <= 450 ? 4 : 0,
    dataFeed: Math.min(15, input.dataFeedQuality * 0.15),
    loginSuccess: Math.min(15, input.loginSuccessPercent * 0.15),
    executionSuccess: Math.min(15, input.executionSuccessPercent * 0.15),
    incidentPenalty: input.criticalIncidents * -12
  };
  const score = clamp(Object.values(factors).reduce((sum, value) => sum + value, 0));
  return { score, rating: rating(score), factors };
}

export function normalizeSymbol(raw: string) {
  const cleaned = raw.toUpperCase().replace(/^(FX_|CASH_)/, "").replace(/(\.PRO|\.RAW|_ECN|_RAW|M|MICRO)$/i, "");
  const canonical = cleaned === "GOLD" ? "XAUUSD" : cleaned === "NASDAQ" ? "NAS100" : cleaned;
  return {
    normalizedSymbol: canonical,
    assetClass: registry[cleaned] ?? registry[canonical] ?? "Unknown",
    known: Boolean(registry[cleaned] ?? registry[canonical])
  };
}

export function analyzeSymbolMappings(symbols: SymbolMapping[]) {
  const counts = new Map<string, number>();
  const unknown: string[] = [];
  const anomalies: string[] = [];
  symbols.forEach((symbol) => {
    const normalized = normalizeSymbol(symbol.brokerSymbol);
    counts.set(normalized.normalizedSymbol, (counts.get(normalized.normalizedSymbol) ?? 0) + 1);
    if (!normalized.known) unknown.push(symbol.brokerSymbol);
    if (symbol.spread > symbol.normalSpread * 2.5) anomalies.push(symbol.brokerSymbol);
  });
  return {
    unknown,
    duplicates: [...counts.entries()].filter(([, count]) => count > 1).map(([symbol]) => symbol),
    spreadAnomalies: anomalies
  };
}

export function detectMarketDataGaps(symbols: SymbolMapping[], now = Date.now(), marketOpen = true) {
  if (!marketOpen) return { missingTicks: [], delayedTicks: [], frozenPrices: [], abnormalSpreads: [] };
  const delayedTicks = symbols.filter((symbol) => now - new Date(symbol.lastTickAt).getTime() > 15_000).map((symbol) => symbol.symbol);
  const missingTicks = symbols.filter((symbol) => !symbol.dataFeedActive).map((symbol) => symbol.symbol);
  return {
    missingTicks,
    delayedTicks,
    frozenPrices: delayedTicks.filter((symbol) => missingTicks.includes(symbol)),
    abnormalSpreads: symbols.filter((symbol) => symbol.spread > symbol.normalSpread * 2.5).map((symbol) => symbol.symbol)
  };
}

export function calculateExecutionQuality(samples: ExecutionSample[]) {
  const total = samples.length || 1;
  const rejected = samples.filter((sample) => sample.rejectionReason).length;
  const requotes = samples.filter((sample) => sample.requoteDetected).length;
  const averageExecutionMs = samples.reduce((sum, sample) => sum + sample.executionTimeMs, 0) / total;
  const averageSlippagePoints = samples.reduce((sum, sample) => sum + Math.abs(sample.slippagePoints), 0) / total;
  const rejectionRate = (rejected / total) * 100;
  const requoteRate = (requotes / total) * 100;
  const fillQualityScore = clamp(100 - averageExecutionMs / 8 - averageSlippagePoints * 4 - rejectionRate * 1.5 - requoteRate);
  return { averageExecutionMs: Math.round(averageExecutionMs), averageSlippagePoints: Number(averageSlippagePoints.toFixed(1)), rejectionRate: Number(rejectionRate.toFixed(1)), requoteRate: Number(requoteRate.toFixed(1)), fillQualityScore };
}

export function rankBrokers(brokers: Broker[]) {
  const executionScore = (broker: Broker) => broker.executionQualityScore - broker.averageLatencyMs / 8 - broker.slippageRate - broker.requoteRate - broker.failedOrderRate;
  const sortedExecution = [...brokers].sort((a, b) => executionScore(b) - executionScore(a));
  const sortedData = [...brokers].sort((a, b) => b.dataFeedQualityScore + b.uptimePercent - (a.dataFeedQualityScore + a.uptimePercent));
  const risky = [...brokers].sort((a, b) => executionScore(a) - executionScore(b))[0];
  return {
    bestForExecution: sortedExecution[0]?.brokerName ?? "Unknown",
    bestForDataQuality: sortedData[0]?.brokerName ?? "Unknown",
    riskyBroker: risky?.brokerName ?? "None",
    requiresMonitoring: brokers.filter((broker) => broker.status !== "Healthy" || executionScore(broker) < 60).map((broker) => broker.brokerName)
  };
}

export function recommendRecovery(terminal: Terminal) {
  if (terminal.status === "Offline") {
    return terminal.autoRestartEnabled
      ? ["Reconnect broker session", "Restart MT5 terminal", "Re-authenticate account", "Re-sync symbols", "Disable trading if critical persists"]
      : ["Reconnect broker session", "Escalate terminal restart approval", "Disable trading if critical persists"];
  }
  if (terminal.latencyMs > 250) return ["Test secondary broker route", "Reduce execution exposure until latency recovers"];
  return ["Continue autonomous heartbeat monitoring"];
}

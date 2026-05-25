import type { ScoreResult } from "../../mt5-control-center/types/mt5-control-center.types";
import type {
  BrokerComparisonRow,
  SpreadAlert,
  SpreadRiskLevel,
  SpreadSnapshot,
  SpreadStatus,
  SpreadThreshold
} from "../types/spread-monitor.types";

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function rating(score: number): ScoreResult["rating"] {
  if (score >= 90) return "Excellent";
  if (score >= 75) return "Healthy";
  if (score >= 60) return "Degraded";
  if (score >= 40) return "High Risk";
  return "Critical";
}

export type SymbolMeta = { digits: number; pipSize: number; assetClass: "Forex" | "Metals" | "Indices" | "Crypto" | "Unknown"; pointValue: number; contractSize: number };

export function calculateSpreadPips(bid: number, ask: number, pipSize: number) {
  const raw = Math.max(0, ask - bid);
  const pips = pipSize > 0 ? raw / pipSize : 0;
  return Number(pips.toFixed(2));
}

export function spreadStatusFromThreshold(currentPips: number, threshold: SpreadThreshold, newsBlackoutActive: boolean) {
  const multiplier = newsBlackoutActive ? threshold.newsMultiplier : 1;
  const warning = threshold.warningLimitPips * multiplier;
  const critical = threshold.criticalLimitPips * multiplier;
  if (currentPips <= warning) return "Normal" as const;
  if (currentPips <= critical) return "Wide" as const;
  return "Critical" as const;
}

export function shouldBlockExecution(params: {
  currentSpreadPips: number;
  rollingAveragePips: number;
  deviationPercent: number;
  stabilityScore: number;
  threshold: SpreadThreshold;
  newsBlackoutActive: boolean;
  brokerIsMateriallyWorseThanPeers: boolean;
  scalpingStrategy: boolean;
}) {
  const multiplier = params.newsBlackoutActive ? params.threshold.newsMultiplier : 1;
  const blockLimit = params.threshold.executionBlockLimitPips * multiplier;
  const criticalLimit = params.threshold.criticalLimitPips * multiplier;
  const scalpingLimit = params.threshold.scalpingMaxSpreadPips * multiplier;

  const reasons: string[] = [];

  if (params.currentSpreadPips >= blockLimit) reasons.push("Spread exceeds execution block limit");
  if (params.newsBlackoutActive) reasons.push("News blackout active");
  if (params.currentSpreadPips >= Math.max(criticalLimit, params.rollingAveragePips * 2)) reasons.push("Spread spike detected vs rolling average/critical limit");
  if (params.deviationPercent >= 120) reasons.push("Spread deviation exceeds configured percentage");
  if (params.stabilityScore <= 55) reasons.push("Spread stability score below threshold");
  if (params.brokerIsMateriallyWorseThanPeers) reasons.push("Broker materially worse than peers");
  if (params.scalpingStrategy && params.currentSpreadPips > scalpingLimit) reasons.push("Scalping max spread exceeded");

  const shouldBlock = reasons.includes("Spread exceeds execution block limit") || reasons.includes("News blackout active") || reasons.length >= 3;
  const severity: "Info" | "Warning" | "Critical" = shouldBlock ? "Critical" : reasons.length ? "Warning" : "Info";
  return { shouldBlock, reasons, severity };
}

export function spreadRiskScore(input: {
  thresholdRatio: number;
  deviationPercent: number;
  brokerDeltaPips: number;
  newsPenalty: number;
  volatilityPenalty: number;
  stabilityScore: number;
}) {
  const thresholdScore = clamp(input.thresholdRatio * 45, 0, 45);
  const deviationScore = clamp((input.deviationPercent / 150) * 18, 0, 18);
  const brokerComparisonScore = clamp((input.brokerDeltaPips / 3) * 14, 0, 14);
  const newsWindowScore = clamp(input.newsPenalty, 0, 10);
  const volatilityScore = clamp(input.volatilityPenalty, 0, 15);
  const stabilityScore = clamp((input.stabilityScore / 100) * 18, 0, 18);

  const risk = clamp(Math.round(thresholdScore + deviationScore + brokerComparisonScore + newsWindowScore + volatilityScore - stabilityScore), 0, 100);
  const score = clamp(100 - risk, 0, 100);
  return {
    score,
    rating: rating(score),
    factors: {
      thresholdScore: Math.round(thresholdScore),
      deviationScore: Math.round(deviationScore),
      brokerComparisonScore: Math.round(brokerComparisonScore),
      newsWindowScore: Math.round(newsWindowScore),
      volatilityScore: Math.round(volatilityScore),
      stabilityScore: Math.round(stabilityScore)
    }
  } satisfies ScoreResult;
}

export function riskLevelFromScore(score: number): SpreadRiskLevel {
  if (score >= 82) return "Critical";
  if (score >= 68) return "High";
  if (score >= 52) return "Elevated";
  if (score >= 35) return "Moderate";
  return "Low";
}

export function buildBrokerComparison(spreads: SpreadSnapshot[]): BrokerComparisonRow[] {
  const bySymbol = new Map<string, SpreadSnapshot[]>();
  for (const row of spreads) {
    const key = row.normalizedSymbol;
    bySymbol.set(key, [...(bySymbol.get(key) ?? []), row]);
  }

  return [...bySymbol.entries()].map(([normalizedSymbol, rows]) => {
    const brokers = rows
      .map((r) => ({ brokerId: r.brokerId, broker: r.broker, currentSpreadPips: r.currentSpreadPips, averageSpreadPips: r.averageSpreadPips }))
      .sort((a, b) => a.currentSpreadPips - b.currentSpreadPips);
    const lowest = brokers[0];
    const highest = brokers[brokers.length - 1];
    const delta = Number(((highest?.currentSpreadPips ?? 0) - (lowest?.currentSpreadPips ?? 0)).toFixed(2));
    const recommendation = delta > 2 ? `Route executions to ${lowest?.broker ?? "best broker"} and monitor ${highest?.broker ?? "worst broker"}.` : "No material broker spread divergence detected.";
    return {
      normalizedSymbol,
      brokers,
      lowestSpreadBroker: lowest?.broker ?? "Unknown",
      highestSpreadBroker: highest?.broker ?? "Unknown",
      spreadDifferencePips: delta,
      bestExecutionBroker: lowest?.broker ?? "Unknown",
      worstExecutionBroker: highest?.broker ?? "Unknown",
      recommendation
    } satisfies BrokerComparisonRow;
  });
}

export function classifyPeerComparison(params: { currentBrokerId: string; normalizedSymbol: string; comparisons: BrokerComparisonRow[] }) {
  const row = params.comparisons.find((c) => c.normalizedSymbol === params.normalizedSymbol);
  if (!row) return { materiallyWorse: false, brokerDeltaPips: 0, classification: "Unknown" as const };
  const sorted = [...row.brokers].sort((a, b) => a.currentSpreadPips - b.currentSpreadPips);
  const current = row.brokers.find((b) => b.brokerId === params.currentBrokerId);
  if (!current) return { materiallyWorse: false, brokerDeltaPips: 0, classification: "Unknown" as const };

  const best = sorted[0];
  const median = sorted[Math.floor(sorted.length / 2)] ?? best;
  const delta = Number((current.currentSpreadPips - (median?.currentSpreadPips ?? current.currentSpreadPips)).toFixed(2));
  const materiallyWorse = delta >= 1.2;
  const classification = materiallyWorse && current.brokerId === row.brokers.find((b) => b.broker === row.highestSpreadBroker)?.brokerId ? "Broker Spike" : delta > 0.6 ? "Symbol Spike" : "Normal";
  return { materiallyWorse, brokerDeltaPips: delta, classification };
}

export function createSpreadAlert(params: {
  row: SpreadSnapshot;
  type: SpreadAlert["alertType"];
  severity: SpreadAlert["severity"];
  thresholdValuePips: number;
  executionBlocked: boolean;
  rootCause: string;
  aiExplanation: string;
}): SpreadAlert {
  return {
    id: `spr-alert-${Date.now()}-${Math.floor(Math.random() * 10_000)}`,
    timestamp: new Date().toISOString(),
    symbol: params.row.symbol,
    normalizedSymbol: params.row.normalizedSymbol,
    brokerId: params.row.brokerId,
    broker: params.row.broker,
    accountId: params.row.accountId,
    account: params.row.account,
    currentSpreadPips: params.row.currentSpreadPips,
    thresholdValuePips: params.thresholdValuePips,
    alertType: params.type,
    severity: params.severity,
    executionBlocked: params.executionBlocked,
    rootCause: params.rootCause,
    aiExplanation: params.aiExplanation,
    resolutionStatus: "Unresolved",
    resolvedAt: null
  };
}

export function deriveSpreadStatus(row: SpreadSnapshot, newsBlackoutActive: boolean): SpreadStatus {
  return spreadStatusFromThreshold(row.currentSpreadPips, row.threshold, newsBlackoutActive);
}

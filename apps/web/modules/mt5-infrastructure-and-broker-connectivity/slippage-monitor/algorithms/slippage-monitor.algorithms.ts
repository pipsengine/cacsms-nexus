import type { ScoreResult } from "../../mt5-control-center/types/mt5-control-center.types";
import type {
  BrokerSlippageComparisonRow,
  SlippageAlert,
  SlippageBreachStatus,
  SlippageDirection,
  SlippageExecution,
  SlippageRiskLevel,
  SlippageThreshold
} from "../types/slippage-monitor.types";

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

export function calculateSlippagePoints(params: { direction: SlippageDirection; requestedPrice: number; executedPrice: number; pointSize: number }) {
  const raw = params.direction === "Buy" ? params.executedPrice - params.requestedPrice : params.requestedPrice - params.executedPrice;
  const points = params.pointSize > 0 ? raw / params.pointSize : 0;
  return Number(points.toFixed(1));
}

export function pointsToPips(points: number, pointsPerPip: number) {
  const pips = pointsPerPip > 0 ? points / pointsPerPip : 0;
  return Number(pips.toFixed(2));
}

export function classifySlippage(pips: number) {
  if (pips > 0.05) return "Positive";
  if (pips < -0.05) return "Negative";
  return "Neutral";
}

export function breachStatusFromThreshold(absSlippagePips: number, threshold: SlippageThreshold, newsWindowActive: boolean): SlippageBreachStatus {
  const multiplier = newsWindowActive ? threshold.newsMultiplier : 1;
  const warn = threshold.warningLimitPips * multiplier;
  const critical = threshold.criticalLimitPips * multiplier;
  const block = threshold.executionBlockLimitPips * multiplier;
  if (absSlippagePips >= block) return "Blocked";
  if (absSlippagePips >= critical) return "Critical";
  if (absSlippagePips >= warn) return "Warning";
  return "Normal";
}

export function shouldBlockExecution(params: {
  breachStatus: SlippageBreachStatus;
  newsWindowActive: boolean;
  volatilityScore: number;
  executionTimeMs: number;
  spreadAtExecution: number;
  peerBrokerMateriallyBetter: boolean;
  threshold: SlippageThreshold;
}) {
  const reasons: string[] = [];
  if (params.breachStatus === "Blocked") reasons.push("Slippage exceeds execution block limit");
  if (params.breachStatus === "Critical") reasons.push("Critical slippage breach");
  if (params.newsWindowActive) reasons.push("News multiplier active");
  if (params.volatilityScore >= 85) reasons.push("Extreme market volatility");
  if (params.executionTimeMs >= 900) reasons.push("Latency-driven slippage risk");
  if (params.spreadAtExecution >= 4.2) reasons.push("Spread-driven slippage risk");
  if (params.peerBrokerMateriallyBetter) reasons.push("Alternative broker materially better");

  const shouldBlock = params.breachStatus === "Blocked" || (params.breachStatus === "Critical" && params.threshold.autoDisableEnabled) || reasons.length >= 4;
  const severity: "Info" | "Warning" | "Critical" = shouldBlock ? "Critical" : reasons.length ? "Warning" : "Info";
  return { shouldBlock, reasons, severity };
}

export function slippageRiskScore(input: {
  thresholdBreachScore: number;
  negativeSlippageScore: number;
  brokerComparisonScore: number;
  latencyImpactScore: number;
  spreadImpactScore: number;
  volatilityImpactScore: number;
}) {
  const risk = clamp(
    Math.round(
      input.thresholdBreachScore +
        input.negativeSlippageScore +
        input.brokerComparisonScore +
        input.latencyImpactScore +
        input.spreadImpactScore +
        input.volatilityImpactScore
    ),
    0,
    100
  );
  const score = clamp(100 - risk, 0, 100);
  return { score, rating: rating(score), factors: { risk } } satisfies ScoreResult;
}

export function riskLevelFromScore(score: number): SlippageRiskLevel {
  if (score < 40) return "Critical";
  if (score < 55) return "High";
  if (score < 70) return "Elevated";
  if (score < 82) return "Moderate";
  return "Low";
}

export function buildBrokerComparison(executions: SlippageExecution[]): BrokerSlippageComparisonRow[] {
  const byKey = new Map<string, SlippageExecution[]>();
  for (const e of executions) {
    const key = `${e.brokerId}::${e.normalizedSymbol}`;
    byKey.set(key, [...(byKey.get(key) ?? []), e]);
  }

  const rows: BrokerSlippageComparisonRow[] = [];
  for (const [key, list] of byKey.entries()) {
    const [brokerId, normalizedSymbol] = key.split("::");
    const broker = list[0]?.broker ?? "Unknown";
    const slippages = list.map((x) => x.slippagePips).sort((a, b) => a - b);
    const abs = list.map((x) => Math.abs(x.slippagePips)).sort((a, b) => a - b);
    const avgAbs = abs.length ? abs.reduce((s, v) => s + v, 0) / abs.length : 0;
    const medianAbs = abs.length ? abs[Math.floor(abs.length / 2)]! : 0;
    const worstAbs = abs.length ? abs[abs.length - 1]! : 0;
    const positiveRate = (list.filter((x) => x.slippagePips > 0.05).length / Math.max(1, list.length)) * 100;
    const negativeRate = (list.filter((x) => x.slippagePips < -0.05).length / Math.max(1, list.length)) * 100;
    const avgExec = list.reduce((s, v) => s + v.executionTimeMs, 0) / Math.max(1, list.length);
    const requoteRate = clamp((list.filter((x) => x.executionQualityScore < 55).length / Math.max(1, list.length)) * 100, 0, 100);
    const rejectionRate = clamp((list.filter((x) => x.breachStatus === "Blocked").length / Math.max(1, list.length)) * 100, 0, 100);
    const executionQualityRank = Math.round(clamp(100 - avgAbs * 12 - avgExec / 20 - rejectionRate * 0.6 - requoteRate * 0.3, 0, 100));

    rows.push({
      brokerId: brokerId ?? "unknown",
      broker,
      normalizedSymbol: normalizedSymbol ?? "Unknown",
      averageSlippagePips: Number(avgAbs.toFixed(2)),
      medianSlippagePips: Number(medianAbs.toFixed(2)),
      worstSlippagePips: Number(worstAbs.toFixed(2)),
      positiveSlippageRate: Number(positiveRate.toFixed(1)),
      negativeSlippageRate: Number(negativeRate.toFixed(1)),
      averageExecutionTimeMs: Math.round(avgExec),
      requoteRate: Number(requoteRate.toFixed(1)),
      rejectionRate: Number(rejectionRate.toFixed(1)),
      executionQualityRank
    });
  }

  return rows.sort((a, b) => b.executionQualityRank - a.executionQualityRank);
}

export function createSlippageAlert(params: {
  execution: SlippageExecution;
  type: SlippageAlert["alertType"];
  severity: SlippageAlert["severity"];
  thresholdValuePips: number;
  executionBlocked: boolean;
  rootCause: string;
  aiExplanation: string;
}): SlippageAlert {
  return {
    id: `slip-alert-${Date.now()}-${Math.floor(Math.random() * 10_000)}`,
    timestamp: new Date().toISOString(),
    executionId: params.execution.executionId,
    orderId: params.execution.orderId,
    brokerId: params.execution.brokerId,
    broker: params.execution.broker,
    symbol: params.execution.symbol,
    normalizedSymbol: params.execution.normalizedSymbol,
    requestedPrice: params.execution.requestedPrice,
    executedPrice: params.execution.executedPrice,
    slippagePips: params.execution.slippagePips,
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


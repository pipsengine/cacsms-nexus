import type {
  BrokerConnection,
  BrokerExecutionQuality,
  BrokerIncident,
  BrokerRankings,
  BrokerScore,
  BrokerSpreadLog
} from "../types/broker-connections.types";

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function rating(score: number): BrokerScore["rating"] {
  if (score >= 90) return "Excellent";
  if (score >= 75) return "Healthy";
  if (score >= 60) return "Degraded";
  if (score >= 40) return "High Risk";
  return "Critical";
}

export function calculateBrokerHealth(broker: BrokerConnection, incidents: BrokerIncident[]): BrokerScore {
  const factors = {
    connectionScore: broker.connectionStatus === "Healthy" ? 18 : broker.connectionStatus === "Degraded" ? 10 : broker.connectionStatus === "Syncing" ? 8 : 0,
    loginScore: Math.round(clamp(broker.loginSuccessRate) * 0.15),
    dataFeedScore: broker.dataFeedActive ? Math.round(clamp(100 - broker.tickDelaySeconds * 3) * 0.15) : 0,
    latencyScore: Math.round(clamp(100 - broker.averageLatencyMs / 4) * 0.15),
    executionScore: broker.executionEnabled ? Math.round(clamp(broker.fillQualityScore) * 0.17) : 0,
    spreadScore: Math.round(clamp(broker.spreadStabilityScore) * 0.2)
  };
  const relevant = incidents.filter((incident) => incident.brokerId === broker.id && incident.resolutionStatus !== "Resolved");
  const incidentPenalty = relevant.reduce((sum, incident) => sum + (incident.severity === "Critical" ? 12 : incident.severity === "Warning" ? 5 : 1), 0);
  const score = clamp(Object.values(factors).reduce((sum, value) => sum + value, 0) - incidentPenalty);
  return { score, rating: rating(score), factors: { ...factors, incidentPenalty: -incidentPenalty } };
}

function reliabilityScore(broker: BrokerConnection) {
  const latency = clamp(100 - broker.averageLatencyMs / 4);
  const executionSpeed = clamp(100 - broker.averageExecutionTimeMs / 5);
  const requoteQuality = clamp(100 - broker.requoteRate * 10);
  const rejectionQuality = clamp(100 - broker.rejectionRate * 10);
  const dataContinuity = clamp(100 - broker.missingDataGapCount * 12 - (broker.dataFeedActive ? 0 : 60));
  return Math.round(
    broker.uptimePercent * 0.2 +
    latency * 0.15 +
    broker.spreadStabilityScore * 0.15 +
    executionSpeed * 0.15 +
    broker.slippageScore * 0.1 +
    requoteQuality * 0.1 +
    rejectionQuality * 0.1 +
    dataContinuity * 0.05
  );
}

export function rankBrokerReliability(brokers: BrokerConnection[]): BrokerRankings {
  const ranked = brokers
    .map((broker) => ({ brokerId: broker.id, brokerName: broker.brokerName, score: reliabilityScore(broker) }))
    .sort((left, right) => right.score - left.score);
  const maxBy = (selector: (broker: BrokerConnection) => number) =>
    [...brokers].sort((left, right) => selector(right) - selector(left))[0]?.brokerName ?? "Unavailable";
  const minBy = (selector: (broker: BrokerConnection) => number) =>
    [...brokers].sort((left, right) => selector(left) - selector(right))[0]?.brokerName ?? "Unavailable";
  return {
    ranked,
    bestExecutionBroker: maxBy((broker) => broker.fillQualityScore - broker.averageExecutionTimeMs / 10),
    bestDataBroker: maxBy((broker) => broker.spreadStabilityScore - broker.missingDataGapCount * 4),
    mostStableBroker: maxBy((broker) => broker.uptimePercent + broker.loginSuccessRate),
    highestRiskBroker: ranked.at(-1)?.brokerName ?? "Unavailable",
    brokerRequiringReview: minBy((broker) => broker.healthScore)
  };
}

export function detectSpreadSpikes(logs: BrokerSpreadLog[], brokerId: string) {
  const affected = logs.filter((log) => log.brokerId === brokerId && (log.abnormalSpreadDetected || log.spreadPoints > log.averageSpreadPoints * 2));
  const symbols = [...new Set(affected.map((log) => log.symbol))];
  return {
    detected: affected.length > 0,
    persistent: affected.length >= 2,
    multipleSymbols: symbols.length >= 2,
    affectedSymbols: symbols,
    severity: symbols.length >= 2 ? "Critical" : affected.length ? "Warning" : "Info"
  };
}

export function detectExecutionDegradation(samples: BrokerExecutionQuality[], brokerId: string) {
  const relevant = samples.filter((sample) => sample.brokerId === brokerId);
  const count = Math.max(1, relevant.length);
  const averageExecutionTimeMs = Math.round(relevant.reduce((sum, sample) => sum + sample.executionTimeMs, 0) / count);
  const averageSlippagePoints = Number((relevant.reduce((sum, sample) => sum + sample.slippagePoints, 0) / count).toFixed(1));
  const requoteRate = Math.round(relevant.filter((sample) => sample.requoteDetected).length / count * 100);
  const rejectionRate = Math.round(relevant.filter((sample) => sample.rejected).length / count * 100);
  return {
    degraded: averageExecutionTimeMs > 300 || averageSlippagePoints > 5 || requoteRate > 10 || rejectionRate > 10,
    averageExecutionTimeMs,
    averageSlippagePoints,
    requoteRate,
    rejectionRate
  };
}

export function recommendBrokerRecovery(broker: BrokerConnection) {
  const steps = ["Classify issue", "Test server reachability", "Validate account login", "Check data feed freshness", "Check execution gateway"];
  if (!broker.serverReachable || broker.connectionStatus !== "Healthy") steps.push("Attempt reconnect");
  steps.push("Re-sync symbols and accounts");
  if (broker.riskLevel === "Critical" || broker.executionStatus === "Critical") steps.push("Disable execution and recommend alternate broker");
  steps.push("Log incident and notify administrator");
  return steps;
}

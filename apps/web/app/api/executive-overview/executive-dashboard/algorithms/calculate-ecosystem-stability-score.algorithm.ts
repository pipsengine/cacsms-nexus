import { clampScore, weightedScore } from "./utils";

export function calculateEcosystemStabilityScore(input: {
  healthScore?: number;
  riskPressureScore?: number;
  executionReadinessScore?: number;
  aiConfidenceScore?: number;
  alertSeverityPenalty?: number;
}) {
  const inverseRisk = clampScore(100 - (input.riskPressureScore ?? 0));
  const alertPenalty = clampScore(input.alertSeverityPenalty ?? 0);

  const { score, factors } = weightedScore([
    { key: "health", value: input.healthScore ?? 0, weight: 30 },
    { key: "executionReadiness", value: input.executionReadinessScore ?? 0, weight: 25 },
    { key: "aiConfidence", value: input.aiConfidenceScore ?? 0, weight: 20 },
    { key: "inverseRiskPressure", value: inverseRisk, weight: 15 },
    { key: "alertPenaltyInverse", value: clampScore(100 - alertPenalty), weight: 10 }
  ]);

  return {
    score,
    explanation: "Ecosystem stability combines health, execution readiness, AI confidence, inverse risk pressure, and an alert severity penalty.",
    factors
  };
}


import { clampScore, safeRatio, weightedScore } from "./utils";

export function calculatePropFirmComplianceScore(input: {
  dailyDrawdownUsed?: number;
  maxDailyDrawdown?: number;
  overallDrawdownUsed?: number;
  maxOverallDrawdown?: number;
  consistencyScore?: number;
  profitTargetProgress?: number;
  ruleViolations?: number;
}) {
  const dailySafety = clampScore((1 - safeRatio(input.dailyDrawdownUsed ?? 0, input.maxDailyDrawdown ?? 0)) * 100);
  const overallSafety = clampScore((1 - safeRatio(input.overallDrawdownUsed ?? 0, input.maxOverallDrawdown ?? 0)) * 100);

  const violationPenalty = Math.min(100, (input.ruleViolations ?? 0) * 20);
  const noViolationsScore = clampScore(100 - violationPenalty);

  const { score, factors } = weightedScore([
    { key: "dailyDrawdownSafety", value: dailySafety, weight: 25 },
    { key: "overallDrawdownSafety", value: overallSafety, weight: 25 },
    { key: "consistency", value: input.consistencyScore ?? 0, weight: 20 },
    { key: "noViolations", value: noViolationsScore, weight: 20 },
    { key: "profitTargetProgress", value: input.profitTargetProgress ?? 0, weight: 10 }
  ]);

  return {
    score,
    explanation: "Compliance score weights drawdown safety, consistency, violations, and profit target progress.",
    factors
  };
}


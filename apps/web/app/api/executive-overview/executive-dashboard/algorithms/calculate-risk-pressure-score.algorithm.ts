import { clampScore, weightedScore } from "./utils";

export function calculateRiskPressureScore(input: {
  dailyDrawdownUsed?: number;
  maxDailyDrawdown?: number;
  overallDrawdownUsed?: number;
  maxOverallDrawdown?: number;
  openExposure?: number;
  correlationRisk?: number;
  newsRisk?: number;
  volatilityRisk?: number;
  spreadRisk?: number;
}) {
  const dailyPressure =
    input.maxDailyDrawdown && input.maxDailyDrawdown > 0 ? (input.dailyDrawdownUsed ?? 0) / input.maxDailyDrawdown : 0;
  const overallPressure =
    input.maxOverallDrawdown && input.maxOverallDrawdown > 0 ? (input.overallDrawdownUsed ?? 0) / input.maxOverallDrawdown : 0;

  const drawdownPressure = clampScore((dailyPressure * 60 + overallPressure * 40) * 100);

  const exposurePressure = clampScore(Math.min(100, (input.openExposure ?? 0) / 1000));

  const { score, factors } = weightedScore([
    { key: "drawdownPressure", value: drawdownPressure, weight: 30 },
    { key: "exposurePressure", value: exposurePressure, weight: 20 },
    { key: "correlationPressure", value: input.correlationRisk ?? 0, weight: 15 },
    { key: "newsPressure", value: input.newsRisk ?? 0, weight: 15 },
    { key: "volatilityPressure", value: input.volatilityRisk ?? 0, weight: 10 },
    { key: "spreadPressure", value: input.spreadRisk ?? 0, weight: 10 }
  ]);

  return {
    score,
    explanation: "Risk pressure blends drawdown utilization, exposure, correlation, news, volatility, and spread pressures.",
    factors
  };
}


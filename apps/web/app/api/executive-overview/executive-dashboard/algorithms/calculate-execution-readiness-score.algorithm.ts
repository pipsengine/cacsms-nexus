import { clampScore, weightedScore } from "./utils";

export function calculateExecutionReadinessScore(input: {
  brokerConnected?: boolean;
  mt5Connected?: boolean;
  eaBridgeActive?: boolean;
  spreadAcceptable?: boolean;
  slippageAcceptable?: boolean;
  riskApproved?: boolean;
  tradePermissionActive?: boolean;
  latencyMs?: number;
  executionEngineHealthy?: boolean;
}) {
  const connectivity =
    (input.brokerConnected ? 50 : 0) + (input.mt5Connected ? 30 : 0) + (input.eaBridgeActive ? 20 : 0);

  const riskPermission =
    (input.riskApproved ? 60 : 0) + (input.tradePermissionActive ? 40 : 0);

  const marketConditions = (input.spreadAcceptable ? 55 : 0) + (input.slippageAcceptable ? 45 : 0);

  const engineHealth = input.executionEngineHealthy ? 100 : 0;

  const latency = clampScore(100 - Math.min(100, (input.latencyMs ?? 999) / 4));

  const { score, factors } = weightedScore([
    { key: "connectivity", value: connectivity, weight: 30 },
    { key: "riskPermission", value: riskPermission, weight: 25 },
    { key: "marketConditions", value: marketConditions, weight: 20 },
    { key: "executionEngineHealth", value: engineHealth, weight: 15 },
    { key: "latency", value: latency, weight: 10 }
  ]);

  return {
    score,
    explanation: "Execution readiness blends connectivity, permissions, market conditions, engine health, and latency.",
    factors
  };
}


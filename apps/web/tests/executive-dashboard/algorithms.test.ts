import { describe, expect, it } from "vitest";

import { calculateAIConfidenceScore } from "@/app/api/executive-overview/executive-dashboard/algorithms/calculate-ai-confidence-score.algorithm";
import { calculateEcosystemStabilityScore } from "@/app/api/executive-overview/executive-dashboard/algorithms/calculate-ecosystem-stability-score.algorithm";
import { calculateExecutionReadinessScore } from "@/app/api/executive-overview/executive-dashboard/algorithms/calculate-execution-readiness-score.algorithm";
import { calculatePropFirmComplianceScore } from "@/app/api/executive-overview/executive-dashboard/algorithms/calculate-prop-firm-compliance-score.algorithm";
import { calculateRiskPressureScore } from "@/app/api/executive-overview/executive-dashboard/algorithms/calculate-risk-pressure-score.algorithm";
import { calculateSystemHealthScore } from "@/app/api/executive-overview/executive-dashboard/algorithms/calculate-system-health-score.algorithm";
import { calculateWorkflowProgressScore } from "@/app/api/executive-overview/executive-dashboard/algorithms/calculate-workflow-progress-score.algorithm";

describe("executive dashboard algorithms", () => {
  it("clamps all scores between 0 and 100", () => {
    const system = calculateSystemHealthScore({
      serviceHealthStates: [
        { status: "Operational", latencyMs: 10, lastHeartbeatAgeSeconds: 2, errorRate: 0 },
        { status: "Offline", latencyMs: 9999, lastHeartbeatAgeSeconds: 9999, errorRate: 2 }
      ]
    });

    const ai = calculateAIConfidenceScore({
      modelConfidence: 120,
      strategyAgreement: -10,
      marketRegimeConfidence: 50,
      visionConfidence: 90,
      sentimentAlignment: 70,
      signalQuality: 80
    });

    const workflow = calculateWorkflowProgressScore({
      stages: [
        { status: "Operational", progress: 100 },
        { status: "Blocked", progress: 0 },
        { status: "Running", progress: 50 }
      ]
    });

    const risk = calculateRiskPressureScore({
      dailyDrawdownUsed: 10_000,
      maxDailyDrawdown: 5_000,
      overallDrawdownUsed: 20_000,
      maxOverallDrawdown: 10_000,
      openExposure: 0,
      correlationRisk: 30,
      newsRisk: 20,
      volatilityRisk: 10,
      spreadRisk: 40
    });

    const compliance = calculatePropFirmComplianceScore({
      dailyDrawdownUsed: 0,
      maxDailyDrawdown: 5000,
      overallDrawdownUsed: 0,
      maxOverallDrawdown: 10000,
      consistencyScore: 80,
      profitTargetProgress: 50,
      ruleViolations: 0
    });

    const execution = calculateExecutionReadinessScore({
      brokerConnected: false,
      mt5Connected: false,
      eaBridgeActive: false,
      spreadAcceptable: true,
      slippageAcceptable: true,
      riskApproved: true,
      tradePermissionActive: true,
      latencyMs: 5,
      executionEngineHealthy: true
    });

    const stability = calculateEcosystemStabilityScore({
      healthScore: system.score,
      riskPressureScore: risk.score,
      executionReadinessScore: execution.score,
      aiConfidenceScore: ai.score,
      alertSeverityPenalty: 15
    });

    for (const result of [system, ai, workflow, risk, compliance, execution, stability]) {
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
      expect(result.explanation.length).toBeGreaterThan(0);
      expect(typeof result.factors).toBe("object");
    }
  });
});


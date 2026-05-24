import type { ExecutiveDashboardResponse, HealthStatus } from "@/modules/executive-overview/executive-dashboard/types/executive-dashboard.types";
import { getExecutiveDashboardMock } from "@/modules/executive-overview/executive-dashboard/data/executive-dashboard.mock";

import { calculateAIConfidenceScore } from "./algorithms/calculate-ai-confidence-score.algorithm";
import { calculateEcosystemStabilityScore } from "./algorithms/calculate-ecosystem-stability-score.algorithm";
import { calculateExecutionReadinessScore } from "./algorithms/calculate-execution-readiness-score.algorithm";
import { calculatePropFirmComplianceScore } from "./algorithms/calculate-prop-firm-compliance-score.algorithm";
import { calculateRiskPressureScore } from "./algorithms/calculate-risk-pressure-score.algorithm";
import { calculateSystemHealthScore } from "./algorithms/calculate-system-health-score.algorithm";
import { calculateWorkflowProgressScore } from "./algorithms/calculate-workflow-progress-score.algorithm";
import { clampScore } from "./algorithms/utils";

function nowIso() {
  return new Date().toISOString();
}

function heartbeatAgeSeconds(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms)) {
    return 1200;
  }
  return Math.max(0, Math.round(ms / 1000));
}

function boolFromHealth(status: HealthStatus) {
  return status === "Operational";
}

function alertPenalty(alerts: ExecutiveDashboardResponse["alerts"]) {
  const penalty = alerts.reduce((sum, alert) => {
    if (alert.severity === "Critical") {
      return sum + 30;
    }
    if (alert.severity === "Warning") {
      return sum + 10;
    }
    if (alert.severity === "Info") {
      return sum + 2;
    }
    return sum;
  }, 0);
  return clampScore(penalty);
}

export function buildExecutiveDashboardResponse(): ExecutiveDashboardResponse {
  const base = getExecutiveDashboardMock();
  const timestamp = nowIso();

  const systemHealthScore = calculateSystemHealthScore({
    serviceHealthStates: base.systems.map((service) => ({
      status: service.status,
      latencyMs: service.latencyMs,
      lastHeartbeatAgeSeconds: heartbeatAgeSeconds(service.lastHeartbeat),
      errorRate: service.errorRate
    }))
  });

  const workflowProgressScore = calculateWorkflowProgressScore({
    stages: base.workflowStages.map((stage) => ({ status: stage.status, progress: stage.progress }))
  });

  const complianceScore = calculatePropFirmComplianceScore({
    dailyDrawdownUsed: base.accountCompliance.dailyDrawdownUsed,
    maxDailyDrawdown: base.accountCompliance.maxDailyDrawdown,
    overallDrawdownUsed: base.accountCompliance.overallDrawdownUsed,
    maxOverallDrawdown: base.accountCompliance.maxOverallDrawdown,
    consistencyScore: base.accountCompliance.consistencyScore,
    profitTargetProgress: base.accountCompliance.profitTargetProgress,
    ruleViolations: base.accountCompliance.ruleViolationCount
  });

  const riskPressureScore = calculateRiskPressureScore({
    dailyDrawdownUsed: base.accountCompliance.dailyDrawdownUsed,
    maxDailyDrawdown: base.accountCompliance.maxDailyDrawdown,
    overallDrawdownUsed: base.accountCompliance.overallDrawdownUsed,
    maxOverallDrawdown: base.accountCompliance.maxOverallDrawdown,
    openExposure: base.accountCompliance.openExposure,
    correlationRisk: base.riskSummary.correlationRisk,
    newsRisk: base.riskSummary.newsRisk,
    volatilityRisk: base.riskSummary.volatilityRisk,
    spreadRisk: base.riskSummary.spreadRisk
  });

  const sentimentAlignment = base.marketCondition.macroRiskState === "Low" ? 80 : base.marketCondition.macroRiskState === "Moderate" ? 60 : 40;
  const strategyAgreement = clampScore(
    base.recentDecisions.length
      ? base.recentDecisions.reduce((sum, decision) => sum + decision.confidence, 0) / base.recentDecisions.length
      : 0
  );

  const aiConfidenceScore = calculateAIConfidenceScore({
    modelConfidence: base.aiIntelligence.orchestrationConfidence,
    strategyAgreement,
    marketRegimeConfidence: base.aiIntelligence.marketRegimeConfidence,
    visionConfidence: base.visionSummary.visionConfidence,
    sentimentAlignment,
    signalQuality: base.aiIntelligence.signalQualityScore
  });

  const executionReadinessScore = calculateExecutionReadinessScore({
    brokerConnected: boolFromHealth(base.mt5BrokerSummary.brokerConnectionStatus),
    mt5Connected: boolFromHealth(base.mt5BrokerSummary.mt5TerminalStatus),
    eaBridgeActive: boolFromHealth(base.mt5BrokerSummary.eaBridgeStatus),
    spreadAcceptable: base.executionSummary.spreadValidationState !== "Fail",
    slippageAcceptable: base.executionSummary.slippageRisk < 50,
    riskApproved: base.executionSummary.riskPermission === "Allowed",
    tradePermissionActive: base.riskSummary.tradePermissionState === "Allowed",
    latencyMs: base.mt5BrokerSummary.latencyMs,
    executionEngineHealthy: base.executionSummary.orderRouterState === "Operational"
  });

  const ecosystemStabilityScore = calculateEcosystemStabilityScore({
    healthScore: systemHealthScore.score,
    riskPressureScore: riskPressureScore.score,
    executionReadinessScore: executionReadinessScore.score,
    aiConfidenceScore: aiConfidenceScore.score,
    alertSeverityPenalty: alertPenalty(base.alerts)
  });

  return {
    ...base,
    meta: {
      ...base.meta,
      timestamp,
      lastUpdated: timestamp
    },
    summary: {
      globalHealthScore: systemHealthScore,
      aiConfidenceScore,
      workflowProgressScore,
      riskPressureScore,
      complianceScore,
      executionReadinessScore,
      ecosystemStabilityScore,
      openAlerts: base.alerts.filter((a) => a.status !== "Resolved").length,
      activeTrades: base.summary.activeTrades
    }
  };
}


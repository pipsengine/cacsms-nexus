import type { ExecutiveDashboardResponse } from "../types/executive-dashboard.types";

function isoNow(offsetSeconds = 0) {
  return new Date(Date.now() + offsetSeconds * 1000).toISOString();
}

const zeroScore = { score: 0, explanation: "", factors: {} };

export function getExecutiveDashboardMock(): ExecutiveDashboardResponse {
  const timestamp = isoNow();
  return {
    meta: {
      timestamp,
      environment: "Development",
      systemMode: "Monitoring",
      activeAccountId: null as unknown as string,
      activeAccountType: "Demo",
      activeAccountName: "",
      lastUpdated: timestamp
    },
    summary: {
      globalHealthScore: zeroScore,
      aiConfidenceScore: zeroScore,
      workflowProgressScore: zeroScore,
      riskPressureScore: zeroScore,
      complianceScore: zeroScore,
      executionReadinessScore: zeroScore,
      ecosystemStabilityScore: zeroScore,
      openAlerts: 0,
      activeTrades: 0
    },
    systems: [],
    workflowStages: [],
    accountCompliance: {
      accountType: "Demo",
      accountBalance: 0,
      equity: 0,
      dailyDrawdownUsed: 0,
      maxDailyDrawdown: 0,
      overallDrawdownUsed: 0,
      maxOverallDrawdown: 0,
      profitTargetProgress: 0,
      consistencyScore: 0,
      tradingDayCount: 0,
      maxLotAllowed: 0,
      openExposure: 0,
      ruleViolationCount: 0,
      propFirmRuleState: "Safe"
    },
    aiIntelligence: {
      orchestrationConfidence: 0,
      marketRegimeConfidence: 0,
      strategySelectionConfidence: 0,
      signalQualityScore: 0,
      modelDriftRisk: 0,
      learningStatus: "Paused",
      activeModelCount: 0,
      decisionLatencyMs: 0,
      activeStrategyFamily: "",
      lastDecisionSummary: ""
    },
    marketCondition: {
      bestAssetCandidate: "",
      marketRegime: "",
      volatilityState: "Low",
      sessionStatus: "Off Hours",
      spreadState: "Normal",
      correlationPressure: 0,
      liquidityQuality: "Fair",
      macroRiskState: "Low",
      newsRiskState: "Low"
    },
    riskSummary: {
      riskState: "Safe",
      accountRiskUsed: 0,
      portfolioExposure: 0,
      correlationRisk: 0,
      newsRisk: 0,
      spreadRisk: 0,
      volatilityRisk: 0,
      killSwitchState: "Disarmed",
      tradePermissionState: "Blocked"
    },
    visionSummary: {
      visionEngineStatus: "Offline",
      latestChartCaptureTime: timestamp,
      analyzedChartsCount: 0,
      detectedOrderBlocks: 0,
      detectedFVGs: 0,
      detectedLiquiditySweeps: 0,
      visionConfidence: 0,
      annotationStatus: "Disabled",
      ocrStatus: "Disabled"
    },
    mt5BrokerSummary: {
      mt5TerminalStatus: "Offline",
      eaBridgeStatus: "Offline",
      brokerConnectionStatus: "Offline",
      accountSyncStatus: "Offline",
      symbolSyncStatus: "Offline",
      tradeSyncStatus: "Offline",
      latencyMs: 0,
      lastHeartbeat: timestamp,
      reconnectAttempts: 0
    },
    executionSummary: {
      executionReadinessScore: 0,
      orderRouterState: "Offline",
      spreadValidationState: "Pass",
      slippageRisk: 0,
      brokerPermission: "Blocked",
      riskPermission: "Blocked",
      mt5Permission: "Blocked",
      preExecutionBlockerCount: 0
    },
    recentDecisions: [],
    alerts: []
  };
}

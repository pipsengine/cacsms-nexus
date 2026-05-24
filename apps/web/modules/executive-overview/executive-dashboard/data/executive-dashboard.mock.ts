import type { ExecutiveDashboardResponse } from "../types/executive-dashboard.types";

function isoNow(offsetSeconds = 0) {
  return new Date(Date.now() + offsetSeconds * 1000).toISOString();
}

export function getExecutiveDashboardMock(): ExecutiveDashboardResponse {
  const timestamp = isoNow();
  const lastUpdated = timestamp;

  return {
    meta: {
      timestamp,
      environment: "Development",
      systemMode: "Monitoring",
      activeAccountId: "acct_prop_001",
      activeAccountType: "Prop Firm",
      activeAccountName: "FTMO Challenge - Demo",
      lastUpdated
    },
    summary: {
      globalHealthScore: { score: 86, explanation: "Healthy baseline across core services with minor cache warnings.", factors: {} },
      aiConfidenceScore: { score: 78, explanation: "Confidence stable with moderate model drift risk.", factors: {} },
      workflowProgressScore: { score: 64, explanation: "Pipeline progressing with some stages offline by design.", factors: {} },
      riskPressureScore: { score: 42, explanation: "Risk pressure moderate; drawdown and exposure within tolerances.", factors: {} },
      complianceScore: { score: 81, explanation: "Compliance posture safe; no active breaches.", factors: {} },
      executionReadinessScore: { score: 55, explanation: "Execution readiness partial; connectivity intentionally disabled.", factors: {} },
      ecosystemStabilityScore: { score: 74, explanation: "Stability strong given monitoring mode and controlled execution boundaries.", factors: {} },
      openAlerts: 3,
      activeTrades: 0
    },
    systems: [
      { key: "frontend", name: "Frontend", status: "Operational", healthScore: 92, latencyMs: 38, lastHeartbeat: isoNow(-5), errorRate: 0.01 },
      { key: "apiGateway", name: "API Gateway", status: "Operational", healthScore: 90, latencyMs: 52, lastHeartbeat: isoNow(-6), errorRate: 0.02 },
      { key: "database", name: "Database", status: "Operational", healthScore: 88, latencyMs: 64, lastHeartbeat: isoNow(-7), errorRate: 0.01 },
      { key: "redis", name: "Redis", status: "Warning", healthScore: 76, latencyMs: 93, lastHeartbeat: isoNow(-9), errorRate: 0.04 },
      { key: "queueWorkers", name: "Queue Workers", status: "Operational", healthScore: 85, latencyMs: 71, lastHeartbeat: isoNow(-8), errorRate: 0.02 },
      { key: "websocket", name: "WebSocket", status: "Degraded", healthScore: 68, latencyMs: 140, lastHeartbeat: isoNow(-18), errorRate: 0.06 },
      { key: "aiOrchestrator", name: "AI Orchestrator", status: "Operational", healthScore: 82, latencyMs: 110, lastHeartbeat: isoNow(-10), errorRate: 0.03 },
      { key: "cacsmsVision", name: "Cacsms Vision", status: "Operational", healthScore: 84, latencyMs: 118, lastHeartbeat: isoNow(-12), errorRate: 0.03 },
      { key: "mt5Bridge", name: "MT5 Bridge", status: "Offline", healthScore: 0, latencyMs: 0, lastHeartbeat: isoNow(-1200), errorRate: 0 },
      { key: "brokerSync", name: "Broker Sync", status: "Offline", healthScore: 0, latencyMs: 0, lastHeartbeat: isoNow(-1200), errorRate: 0 },
      { key: "executionEngine", name: "Execution Engine", status: "Offline", healthScore: 0, latencyMs: 0, lastHeartbeat: isoNow(-1200), errorRate: 0 },
      { key: "riskEngine", name: "Risk Engine", status: "Operational", healthScore: 86, latencyMs: 58, lastHeartbeat: isoNow(-8), errorRate: 0.01 },
      { key: "monitoringService", name: "Monitoring", status: "Operational", healthScore: 88, latencyMs: 44, lastHeartbeat: isoNow(-5), errorRate: 0.01 },
      { key: "learningService", name: "Learning Service", status: "Degraded", healthScore: 63, latencyMs: 155, lastHeartbeat: isoNow(-24), errorRate: 0.06 }
    ],
    workflowStages: [
      { stageNumber: 1, title: "Human Administration", status: "Operational", progress: 100, latencyMs: 12, health: "Nominal", colorType: "blue" },
      { stageNumber: 2, title: "Infrastructure Validation", status: "Running", progress: 90, latencyMs: 24, health: "Stable", colorType: "green" },
      { stageNumber: 3, title: "Autonomous Computer Operation", status: "Pending", progress: 35, latencyMs: 140, health: "Watch", colorType: "teal" },
      { stageNumber: 4, title: "MT5/Broker Control", status: "Offline", progress: 0, latencyMs: 0, health: "Offline", colorType: "gray" },
      { stageNumber: 5, title: "Market Data Acquisition", status: "Analyzing", progress: 72, latencyMs: 42, health: "Stable", colorType: "blue" },
      { stageNumber: 6, title: "Data Engineering", status: "Running", progress: 66, latencyMs: 55, health: "Stable", colorType: "indigo" },
      { stageNumber: 7, title: "Market Regime Classification", status: "Analyzing", progress: 61, latencyMs: 78, health: "Watch", colorType: "purple" },
      { stageNumber: 8, title: "Multi-Timeframe Analysis", status: "Pending", progress: 40, latencyMs: 95, health: "Watch", colorType: "blue" },
      { stageNumber: 9, title: "Cacsms Vision AI", status: "Running", progress: 58, latencyMs: 104, health: "Stable", colorType: "purple" },
      { stageNumber: 10, title: "Institutional Intelligence", status: "Pending", progress: 31, latencyMs: 86, health: "Watch", colorType: "teal" },
      { stageNumber: 11, title: "Retail Strategy Intelligence", status: "Pending", progress: 25, latencyMs: 88, health: "Watch", colorType: "pink" },
      { stageNumber: 12, title: "Quantitative Intelligence", status: "Pending", progress: 22, latencyMs: 102, health: "Watch", colorType: "indigo" },
      { stageNumber: 13, title: "Fundamental & Sentiment Intelligence", status: "Pending", progress: 18, latencyMs: 120, health: "Watch", colorType: "orange" },
      { stageNumber: 14, title: "AI Strategy Orchestration", status: "Running", progress: 46, latencyMs: 135, health: "Stable", colorType: "purple" },
      { stageNumber: 15, title: "AI Decision Engine", status: "Running", progress: 49, latencyMs: 142, health: "Stable", colorType: "purple" },
      { stageNumber: 16, title: "Risk Governance", status: "Operational", progress: 80, latencyMs: 62, health: "Stable", colorType: "red" },
      { stageNumber: 17, title: "Pre-Execution Validation", status: "Blocked", progress: 0, latencyMs: 0, health: "Blocked", colorType: "red" },
      { stageNumber: 18, title: "Trade Execution", status: "Offline", progress: 0, latencyMs: 0, health: "Offline", colorType: "gray" },
      { stageNumber: 19, title: "Active Trade Management", status: "Offline", progress: 0, latencyMs: 0, health: "Offline", colorType: "gray" },
      { stageNumber: 20, title: "Reporting & Explainability", status: "Running", progress: 52, latencyMs: 46, health: "Nominal", colorType: "blue" },
      { stageNumber: 21, title: "Learning & Optimization", status: "Learning", progress: 33, latencyMs: 156, health: "Stable", colorType: "purple" },
      { stageNumber: 22, title: "Monitoring & Self-Healing", status: "Recovering", progress: 58, latencyMs: 88, health: "Watch", colorType: "orange" },
      { stageNumber: 23, title: "Continuous Autonomous Loop", status: "Warning", progress: 41, latencyMs: 0, health: "Degraded", colorType: "red" }
    ],
    accountCompliance: {
      accountType: "Prop Firm",
      accountBalance: 100_000,
      equity: 99_240,
      dailyDrawdownUsed: 320,
      maxDailyDrawdown: 5_000,
      overallDrawdownUsed: 760,
      maxOverallDrawdown: 10_000,
      profitTargetProgress: 18,
      consistencyScore: 72,
      tradingDayCount: 4,
      maxLotAllowed: 2.0,
      openExposure: 0,
      ruleViolationCount: 0,
      propFirmRuleState: "Safe"
    },
    aiIntelligence: {
      orchestrationConfidence: 79,
      marketRegimeConfidence: 74,
      strategySelectionConfidence: 76,
      signalQualityScore: 71,
      modelDriftRisk: 28,
      learningStatus: "Learning",
      activeModelCount: 6,
      decisionLatencyMs: 142,
      activeStrategyFamily: "Institutional Momentum",
      lastDecisionSummary: "No-trade condition retained: spread validation and broker permission disabled."
    },
    marketCondition: {
      bestAssetCandidate: "XAUUSD",
      marketRegime: "Range → Breakout Watch",
      volatilityState: "Moderate",
      sessionStatus: "New York",
      spreadState: "Normal",
      correlationPressure: 34,
      liquidityQuality: "Good",
      macroRiskState: "Moderate",
      newsRiskState: "Low"
    },
    riskSummary: {
      riskState: "Safe",
      accountRiskUsed: 18,
      portfolioExposure: 0,
      correlationRisk: 24,
      newsRisk: 18,
      spreadRisk: 41,
      volatilityRisk: 28,
      killSwitchState: "Armed",
      tradePermissionState: "Restricted"
    },
    visionSummary: {
      visionEngineStatus: "Operational",
      latestChartCaptureTime: isoNow(-92),
      analyzedChartsCount: 14,
      detectedOrderBlocks: 6,
      detectedFVGs: 3,
      detectedLiquiditySweeps: 2,
      visionConfidence: 73,
      annotationStatus: "Enabled",
      ocrStatus: "Enabled"
    },
    mt5BrokerSummary: {
      mt5TerminalStatus: "Offline",
      eaBridgeStatus: "Offline",
      brokerConnectionStatus: "Offline",
      accountSyncStatus: "Offline",
      symbolSyncStatus: "Offline",
      tradeSyncStatus: "Offline",
      latencyMs: 0,
      lastHeartbeat: isoNow(-1200),
      reconnectAttempts: 0
    },
    executionSummary: {
      executionReadinessScore: 55,
      orderRouterState: "Offline",
      spreadValidationState: "Warn",
      slippageRisk: 32,
      brokerPermission: "Blocked",
      riskPermission: "Allowed",
      mt5Permission: "Blocked",
      preExecutionBlockerCount: 2
    },
    recentDecisions: [
      {
        id: "dec_001",
        timestamp: isoNow(-210),
        asset: "XAUUSD",
        decision: "Wait",
        confidence: 74,
        strategyFamily: "Institutional Momentum",
        riskApproval: "Review",
        reasonSummary: "Spread validation warns; broker connectivity disabled; holding until execution boundary clears."
      },
      {
        id: "dec_002",
        timestamp: isoNow(-420),
        asset: "EURUSD",
        decision: "Blocked",
        confidence: 69,
        strategyFamily: "Mean Reversion",
        riskApproval: "Rejected",
        reasonSummary: "Pre-execution validation blocked: MT5 and broker permissions are disabled."
      },
      {
        id: "dec_003",
        timestamp: isoNow(-720),
        asset: "NAS100",
        decision: "Wait",
        confidence: 77,
        strategyFamily: "Breakout",
        riskApproval: "Approved",
        reasonSummary: "Regime confidence acceptable but session liquidity not optimal; waiting for confirmation."
      }
    ],
    alerts: [
      {
        id: "al_001",
        severity: "Warning",
        source: "WebSocket",
        message: "Realtime channel degraded; snapshot refresh mode active.",
        timestamp: isoNow(-380),
        status: "Acknowledged",
        suggestedAction: "Verify SSE/WebSocket endpoint readiness and heartbeat interval."
      },
      {
        id: "al_002",
        severity: "Info",
        source: "Compliance",
        message: "No active rule violations detected in current session.",
        timestamp: isoNow(-980),
        status: "Open",
        suggestedAction: "Continue monitoring drawdown and consistency windows."
      },
      {
        id: "al_003",
        severity: "Critical",
        source: "MT5 Bridge",
        message: "MT5 bridge offline (execution intentionally disabled).",
        timestamp: isoNow(-1200),
        status: "Open",
        suggestedAction: "Keep execution boundaries disabled until MT5 integration phase."
      }
    ]
  };
}

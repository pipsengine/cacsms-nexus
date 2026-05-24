export type Environment = "Development" | "Staging" | "Production";
export type SystemMode = "Autonomous" | "Semi-Autonomous" | "Monitoring" | "Paused";
export type AccountType = "Prop Firm" | "Broker" | "Demo" | "Paper";

export type HealthStatus = "Operational" | "Degraded" | "Offline" | "Warning";

export type NavigationStatus = "Operational" | "Foundation" | "Reserved" | "Planned" | "Disabled";

export type ScoreExplanation = {
  score: number;
  explanation: string;
  factors: Record<string, number>;
};

export type ExecutiveDashboardMeta = {
  timestamp: string;
  environment: Environment;
  systemMode: SystemMode;
  activeAccountId: string;
  activeAccountType: AccountType;
  activeAccountName: string;
  lastUpdated: string;
};

export type ExecutiveDashboardSummary = {
  globalHealthScore: ScoreExplanation;
  aiConfidenceScore: ScoreExplanation;
  workflowProgressScore: ScoreExplanation;
  riskPressureScore: ScoreExplanation;
  complianceScore: ScoreExplanation;
  executionReadinessScore: ScoreExplanation;
  ecosystemStabilityScore: ScoreExplanation;
  openAlerts: number;
  activeTrades: number;
};

export type SystemHealthItem = {
  key:
    | "frontend"
    | "apiGateway"
    | "database"
    | "redis"
    | "queueWorkers"
    | "websocket"
    | "aiOrchestrator"
    | "cacsmsVision"
    | "mt5Bridge"
    | "brokerSync"
    | "executionEngine"
    | "riskEngine"
    | "monitoringService"
    | "learningService";
  name: string;
  status: HealthStatus;
  healthScore: number;
  latencyMs: number;
  lastHeartbeat: string;
  errorRate: number;
};

export type WorkflowStageSummary = {
  stageNumber: number;
  title: string;
  status: "Operational" | "Running" | "Analyzing" | "Pending" | "Approved" | "Blocked" | "Warning" | "Critical" | "Learning" | "Recovering" | "Offline";
  progress: number;
  latencyMs: number;
  health: "Nominal" | "Stable" | "Watch" | "Blocked" | "Degraded" | "Offline";
  colorType: "blue" | "purple" | "green" | "red" | "orange" | "yellow" | "teal" | "indigo" | "pink" | "gray";
};

export type AccountComplianceSummary = {
  accountType: AccountType;
  accountBalance: number;
  equity: number;
  dailyDrawdownUsed: number;
  maxDailyDrawdown: number;
  overallDrawdownUsed: number;
  maxOverallDrawdown: number;
  profitTargetProgress: number;
  consistencyScore: number;
  tradingDayCount: number;
  maxLotAllowed: number;
  openExposure: number;
  ruleViolationCount: number;
  propFirmRuleState: "Safe" | "Warning" | "Critical" | "Breach Risk" | "Blocked";
};

export type AiIntelligenceSummary = {
  orchestrationConfidence: number;
  marketRegimeConfidence: number;
  strategySelectionConfidence: number;
  signalQualityScore: number;
  modelDriftRisk: number;
  learningStatus: "Learning" | "Stable" | "Paused";
  activeModelCount: number;
  decisionLatencyMs: number;
  activeStrategyFamily: string;
  lastDecisionSummary: string;
};

export type MarketConditionSummary = {
  bestAssetCandidate: string;
  marketRegime: string;
  volatilityState: "Low" | "Moderate" | "High";
  sessionStatus: "Asia" | "London" | "New York" | "Off Hours";
  spreadState: "Tight" | "Normal" | "Wide";
  correlationPressure: number;
  liquidityQuality: "Poor" | "Fair" | "Good" | "Excellent";
  macroRiskState: "Low" | "Moderate" | "High";
  newsRiskState: "Low" | "Moderate" | "High";
};

export type RiskCommandSummary = {
  riskState: "Safe" | "Warning" | "Critical" | "Blocked";
  accountRiskUsed: number;
  portfolioExposure: number;
  correlationRisk: number;
  newsRisk: number;
  spreadRisk: number;
  volatilityRisk: number;
  killSwitchState: "Armed" | "Disarmed" | "Triggered";
  tradePermissionState: "Allowed" | "Restricted" | "Blocked";
};

export type VisionSummary = {
  visionEngineStatus: HealthStatus;
  latestChartCaptureTime: string;
  analyzedChartsCount: number;
  detectedOrderBlocks: number;
  detectedFVGs: number;
  detectedLiquiditySweeps: number;
  visionConfidence: number;
  annotationStatus: "Enabled" | "Disabled";
  ocrStatus: "Enabled" | "Disabled";
};

export type Mt5BrokerSummary = {
  mt5TerminalStatus: HealthStatus;
  eaBridgeStatus: HealthStatus;
  brokerConnectionStatus: HealthStatus;
  accountSyncStatus: HealthStatus;
  symbolSyncStatus: HealthStatus;
  tradeSyncStatus: HealthStatus;
  latencyMs: number;
  lastHeartbeat: string;
  reconnectAttempts: number;
};

export type ExecutionSummary = {
  executionReadinessScore: number;
  orderRouterState: HealthStatus;
  spreadValidationState: "Pass" | "Warn" | "Fail";
  slippageRisk: number;
  brokerPermission: "Allowed" | "Blocked";
  riskPermission: "Allowed" | "Blocked";
  mt5Permission: "Allowed" | "Blocked";
  preExecutionBlockerCount: number;
};

export type RecentAiDecision = {
  id: string;
  timestamp: string;
  asset: string;
  decision: "Buy" | "Sell" | "Wait" | "Blocked";
  confidence: number;
  strategyFamily: string;
  riskApproval: "Approved" | "Rejected" | "Review";
  reasonSummary: string;
};

export type AlertIncident = {
  id: string;
  severity: "Info" | "Warning" | "Critical" | "Resolved";
  source: string;
  message: string;
  timestamp: string;
  status: "Open" | "Acknowledged" | "Resolved";
  suggestedAction: string;
};

export type ExecutiveDashboardResponse = {
  meta: ExecutiveDashboardMeta;
  summary: ExecutiveDashboardSummary;
  systems: SystemHealthItem[];
  workflowStages: WorkflowStageSummary[];
  accountCompliance: AccountComplianceSummary;
  aiIntelligence: AiIntelligenceSummary;
  marketCondition: MarketConditionSummary;
  riskSummary: RiskCommandSummary;
  visionSummary: VisionSummary;
  mt5BrokerSummary: Mt5BrokerSummary;
  executionSummary: ExecutionSummary;
  recentDecisions: RecentAiDecision[];
  alerts: AlertIncident[];
};


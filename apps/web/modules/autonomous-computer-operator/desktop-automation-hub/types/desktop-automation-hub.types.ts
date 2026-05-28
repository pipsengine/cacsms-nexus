import type { Mt5Role, ScoreResult } from "@/modules/mt5-infrastructure-and-broker-connectivity/mt5-control-center/types/mt5-control-center.types";
import type { ChartAnalysis, Timeframe } from "@/modules/mt5-infrastructure-and-broker-connectivity/chart-control/types/chart-control.types";
import type { TerminalStatusRecord } from "@/modules/mt5-infrastructure-and-broker-connectivity/terminal-status/types/terminal-status.types";

export type AutomationTone = "Healthy" | "Watch" | "Degraded" | "Critical" | "Offline" | "Pending" | "Running" | "Completed" | "Failed" | "Skipped";

export type AutomationStepType =
  | "open_mt5_chart"
  | "select_symbol"
  | "select_timeframe"
  | "capture_screenshot"
  | "queue_ai_analysis";

export type AutomationRunStatus = "Queued" | "Running" | "Completed" | "Failed" | "Cancelled";

export type DesktopOperatorCommand = {
  id: string;
  runId: string;
  stepId: string;
  commandType: "ChartOpen" | "SymbolSelect" | "TimeframeSelect" | "ScreenshotCapture" | "FocusWindow";
  terminalId: string;
  hostMachine: string;
  payload: Record<string, string | number | boolean>;
  status: "Pending" | "Executed" | "Failed";
  executedAt: string | null;
  detail: string;
};

export type AutomationStep = {
  id: string;
  type: AutomationStepType;
  title: string;
  timeframe: Timeframe | null;
  status: AutomationTone;
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
  detail: string;
  snapshotId: string | null;
  aiAnalysis: ChartAnalysis | null;
  operatorCommands: DesktopOperatorCommand[];
  error: string | null;
};

export type TopDownAnalysisRun = {
  id: string;
  symbol: string;
  normalizedSymbol: string;
  terminalId: string;
  terminalName: string;
  hostMachine: string;
  brokerName: string;
  instrumentId: string | null;
  timeframes: Timeframe[];
  status: AutomationRunStatus;
  currentStepId: string | null;
  steps: AutomationStep[];
  screenshotsCaptured: number;
  aiAnalysisQueued: number;
  startedAt: string;
  completedAt: string | null;
  initiatedBy: Mt5Role;
  summary: string;
};

export type TerminalAutomationTarget = {
  terminalId: string;
  terminalName: string;
  hostMachine: string;
  brokerName: string;
  accountLogin: string;
  processStatus: TerminalStatusRecord["processStatus"];
  automationReady: boolean;
  automationBlockers: string[];
  status: AutomationTone;
};

export type SymbolAutomationOption = {
  symbol: string;
  normalizedSymbol: string;
  brokers: string[];
  instrumentIds: string[];
};

export type DesktopAutomationHubResponse = {
  meta: {
    timestamp: string;
    currentRole: Mt5Role;
    streamEndpoint: string;
    monitoringMode: string;
    highlightedTerminalId: string | null;
    operatorReadiness: ScoreResult;
  };
  kpis: Array<{ label: string; value: string; status: AutomationTone; detail: string; updatedAt: string }>;
  operator: {
    autonomousMode: boolean;
    activeRunId: string | null;
    lastCompletedAt: string | null;
    description: string;
  };
  topDownTimeframes: Timeframe[];
  terminals: TerminalAutomationTarget[];
  symbols: SymbolAutomationOption[];
  activeRun: TopDownAnalysisRun | null;
  recentRuns: TopDownAnalysisRun[];
  permissions: {
    role: Mt5Role;
    canStartAutomation: boolean;
    canCancelAutomation: boolean;
    canViewAiCaptures: boolean;
  };
};

export const TOP_DOWN_TIMEFRAMES = ["D1", "H4", "H1", "M15", "M5"] as const satisfies readonly Timeframe[];

export const AUTOMATION_SYMBOL_CATALOG = ["EURUSD", "GBPUSD", "USDJPY", "AUDUSD", "USDCAD", "XAUUSD", "NAS100"] as const;

export type TopDownAnalysisInput = {
  symbol: string;
  terminalId: string;
  timeframes?: Timeframe[];
  autonomous?: boolean;
};

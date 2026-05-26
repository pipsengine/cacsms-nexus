import type {
  AiSlippageDiagnostic,
  BrokerSlippageComparisonRow,
  SlippageAlert,
  SlippageExecution,
  SlippageLogEntry,
  SlippageThreshold,
  SlippageTrendPoint,
  SlippageWorkflowNode
} from "../types/slippage-monitor.types";

export const symbolMeta: Record<string, { digits: number; pointSize: number; pointsPerPip: number; pipValue: number }> = {};

export function createMockThresholds(): SlippageThreshold[] {
  return [];
}

export function createMockExecutions(_thresholds: SlippageThreshold[]): SlippageExecution[] {
  return [];
}

export function createMockTrends(_executions: SlippageExecution[]): SlippageTrendPoint[] {
  return [];
}

export function createMockAlerts(_executions: SlippageExecution[]): SlippageAlert[] {
  return [];
}

export function createMockLogs(_executions: SlippageExecution[]): SlippageLogEntry[] {
  return [];
}

export function createMockWorkflow(_executions: SlippageExecution[], _alerts: SlippageAlert[]): SlippageWorkflowNode[] {
  return [];
}

export function createMockAiDiagnostics(_executions: SlippageExecution[]): AiSlippageDiagnostic[] {
  return [];
}

export function createSlippageMonitorSeed(): {
  thresholds: SlippageThreshold[];
  executions: SlippageExecution[];
  trends: SlippageTrendPoint[];
  alerts: SlippageAlert[];
  logs: SlippageLogEntry[];
  workflow: SlippageWorkflowNode[];
  brokerComparison: BrokerSlippageComparisonRow[];
  aiDiagnostics: AiSlippageDiagnostic[];
} {
  return {
    thresholds: [],
    executions: [],
    trends: [],
    alerts: [],
    logs: [],
    workflow: [],
    brokerComparison: [],
    aiDiagnostics: []
  };
}

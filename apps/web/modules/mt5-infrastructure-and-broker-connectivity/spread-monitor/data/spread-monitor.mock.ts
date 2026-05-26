import type {
  SpreadAlert,
  SpreadLogEntry,
  SpreadSnapshot,
  SpreadThreshold,
  SpreadTrendPoint,
  SpreadWorkflowNode
} from "../types/spread-monitor.types";

export const symbolMeta: Record<string, { digits: number; pipSize: number; pointValue: number; contractSize: number }> = {};

export function createMockThresholds(): SpreadThreshold[] {
  return [];
}

export function createMockSpreads(_thresholds: SpreadThreshold[]): SpreadSnapshot[] {
  return [];
}

export function createMockTrends(_spreads: SpreadSnapshot[]): SpreadTrendPoint[] {
  return [];
}

export function createMockAlerts(_spreads: SpreadSnapshot[]): SpreadAlert[] {
  return [];
}

export function createMockLogs(_spreads: SpreadSnapshot[]): SpreadLogEntry[] {
  return [];
}

export function createMockWorkflow(_spreads: SpreadSnapshot[], _alerts: SpreadAlert[]): SpreadWorkflowNode[] {
  return [];
}

export function createSpreadMonitorSeed() {
  return {
    thresholds: [],
    spreads: [],
    trends: [],
    alerts: [],
    logs: [],
    workflow: []
  };
}

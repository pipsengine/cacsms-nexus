import type { Timeframe } from "../types/chart-control.types";

export function createChartControlSeed() {
  return {
    instruments: [],
    layouts: [],
    drawings: [],
    signals: [],
    snapshots: []
  };
}

export const timeframes: Timeframe[] = ["M1", "M5", "M15", "H1", "H4", "D1"];

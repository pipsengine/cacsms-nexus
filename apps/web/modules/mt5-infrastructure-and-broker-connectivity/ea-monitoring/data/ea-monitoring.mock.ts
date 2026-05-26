import type { ScoreResult } from "../../mt5-control-center/types/mt5-control-center.types";
import { buildWorkflow } from "../algorithms/ea-monitoring.algorithms";

export function createEaMonitoringSeed() {
  const eaHealthScore: ScoreResult = { score: 0, rating: "Critical", factors: {} };
  return {
    instances: [],
    commands: [],
    bindings: [],
    logs: [],
    exceptions: [],
    analytics: [],
    diagnostics: [],
    audit: [],
    workflow: buildWorkflow([], null),
    kpis: [],
    eaHealthScore
  };
}

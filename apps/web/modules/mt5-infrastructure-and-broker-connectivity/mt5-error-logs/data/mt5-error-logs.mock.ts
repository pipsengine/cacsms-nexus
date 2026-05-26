import {
  buildCategories,
  buildFingerprints,
  buildTrends,
  buildWorkflow
} from "../algorithms/mt5-error-logs.algorithms";

export function createMt5ErrorLogsSeed() {
  const errors = [];
  const aiRiskScore = { score: 0, rating: "Excellent" as const, factors: {} };
  return {
    errors: [],
    fingerprints: buildFingerprints(errors),
    categories: buildCategories(errors),
    trends: buildTrends(errors),
    workflow: buildWorkflow(errors),
    diagnostics: [],
    incidents: [],
    resolutions: [],
    audit: [],
    kpis: [],
    aiRiskScore
  };
}

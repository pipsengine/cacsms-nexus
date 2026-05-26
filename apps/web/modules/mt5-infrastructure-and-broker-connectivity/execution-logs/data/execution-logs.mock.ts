import {
  buildDiagnostics,
  buildExceptions,
  buildWorkflow,
  executionQualityScore,
  toQualityMetrics
} from "../algorithms/execution-logs.algorithms";

export function createExecutionLogsSeed() {
  const logs = [];
  const qualityScore = executionQualityScore({
    successRate: 1,
    averageExecutionTimeMs: 0,
    averageSlippagePoints: 0,
    rejectionRate: 0,
    requoteRate: 0,
    feedbackCompletenessRate: 1,
    retryRate: 0,
    timeoutRate: 0
  });
  const qualityMetrics = toQualityMetrics(logs, []);
  const exceptions = buildExceptions(logs);
  const diagnostics = buildDiagnostics(logs, exceptions);
  const workflow = buildWorkflow(logs);
  return {
    logs: [],
    brokerResponses: [],
    retries: [],
    qualityMetrics,
    exceptions,
    diagnostics,
    workflow,
    audit: [],
    qualityScore
  };
}

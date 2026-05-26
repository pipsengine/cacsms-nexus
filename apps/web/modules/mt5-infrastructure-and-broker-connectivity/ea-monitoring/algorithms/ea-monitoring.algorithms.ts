import type {
  AiEaDiagnostic,
  EaInstance,
  EaMonitoringWorkflowNode,
  EaReadiness,
  EaStrategyBinding
} from "../types/ea-monitoring.types";

export function eaHealthScore(input: {
  heartbeatDelaySeconds: number;
  heartbeatStatus: EaInstance["heartbeatStatus"];
  bridgeStatus: EaInstance["bridgeStatus"];
  strategyBindingOk: boolean;
  commandSuccessRate: number;
  executionFeedbackStatus: EaInstance["executionFeedbackStatus"];
  riskRulesLoaded: boolean;
  riskLevel: EaInstance["riskLevel"];
  restartCount: number;
  errorFrequency: number;
}) {
  const clamp = (x: number, min: number, max: number) => Math.max(min, Math.min(max, x));

  const heartbeatScore =
    input.heartbeatStatus === "Active" ? clamp(20 - input.heartbeatDelaySeconds * 0.4, 8, 20) :
    input.heartbeatStatus === "Delayed" ? 6 :
    0;

  const bridgeConnectionScore =
    input.bridgeStatus === "Connected" ? 15 :
    input.bridgeStatus === "Degraded" ? 8 :
    0;

  const strategyBindingScore = input.strategyBindingOk ? 12 : 0;
  const commandSuccessScore = clamp(input.commandSuccessRate / 100 * 18, 0, 18);
  const executionFeedbackScore =
    input.executionFeedbackStatus === "Ready" ? 12 :
    input.executionFeedbackStatus === "Degraded" ? 6 :
    0;

  const riskComplianceScore = input.riskRulesLoaded ? 12 : 0;
  const errorPenalty = clamp(input.errorFrequency * 4, 0, 16);
  const restartPenalty = clamp(Math.log2(Math.max(1, input.restartCount)) * 4, 0, 16);
  const riskPenalty = input.riskLevel === "Critical" ? 14 : input.riskLevel === "High" ? 10 : input.riskLevel === "Elevated" ? 6 : 0;

  const raw = heartbeatScore + bridgeConnectionScore + strategyBindingScore + commandSuccessScore + executionFeedbackScore + riskComplianceScore - errorPenalty - restartPenalty - riskPenalty;
  return clamp(Math.round(raw * 2), 0, 100);
}

export function readinessValidation(input: Pick<EaInstance,
  | "heartbeatStatus"
  | "connectionStatus"
  | "bridgeStatus"
  | "strategyId"
  | "symbolScope"
  | "riskRulesLoaded"
  | "tradingEnabled"
  | "emergencyStopActive"
  | "spreadFilterActive"
  | "slippageFilterActive"
  | "latencyFilterActive"
  | "duplicateProtectionActive"
  | "accountTradingAllowed"
  | "symbolTradingAllowed"
>) {
  const blockers: string[] = [];
  const heartbeatActive = input.heartbeatStatus === "Active";
  const terminalOnline = input.connectionStatus === "Online";
  const bridgeConnected = input.bridgeStatus === "Connected";
  const brokerAccountAuthenticated = input.accountTradingAllowed;
  const strategyBindingValid = Boolean(input.strategyId);
  const symbolScopeValid = input.symbolScope.length > 0 && input.symbolTradingAllowed;
  const riskRulesLoaded = input.riskRulesLoaded;
  const tradingEnabled = input.tradingEnabled;
  const emergencyStopInactive = !input.emergencyStopActive;
  const spreadFilterActive = input.spreadFilterActive;
  const slippageFilterActive = input.slippageFilterActive;
  const latencyFilterActive = input.latencyFilterActive;
  const duplicateProtectionActive = input.duplicateProtectionActive;

  if (!heartbeatActive) blockers.push("heartbeat-not-active");
  if (!terminalOnline) blockers.push("terminal-offline");
  if (!bridgeConnected) blockers.push("bridge-disconnected");
  if (!brokerAccountAuthenticated) blockers.push("account-trading-not-allowed");
  if (!strategyBindingValid) blockers.push("strategy-not-bound");
  if (!symbolScopeValid) blockers.push("symbol-scope-invalid");
  if (!riskRulesLoaded) blockers.push("risk-rules-not-loaded");
  if (!tradingEnabled) blockers.push("trading-disabled");
  if (!emergencyStopInactive) blockers.push("emergency-stop-active");
  if (!duplicateProtectionActive) blockers.push("duplicate-protection-off");
  if (!spreadFilterActive) blockers.push("spread-filter-off");
  if (!slippageFilterActive) blockers.push("slippage-filter-off");
  if (!latencyFilterActive) blockers.push("latency-filter-off");

  const executionReady = blockers.length === 0;
  const readiness: EaReadiness = {
    heartbeatActive,
    terminalOnline,
    bridgeConnected,
    brokerAccountAuthenticated,
    strategyBindingValid,
    symbolScopeValid,
    riskRulesLoaded,
    tradingEnabled,
    emergencyStopInactive,
    spreadFilterActive,
    slippageFilterActive,
    latencyFilterActive,
    duplicateProtectionActive,
    executionReady,
    blockers
  };
  return readiness;
}

export function strategyBindingIntegrity(instance: Pick<EaInstance, "strategyId" | "strategyVersion" | "symbolScope" | "timeframeScope" | "riskProfile">, binding: EaStrategyBinding | null) {
  const issues: string[] = [];
  if (!binding) {
    issues.push("missing-binding");
    return { ok: false, issues };
  }
  if (instance.strategyId !== binding.strategyId) issues.push("wrong-strategy");
  if (instance.strategyVersion && instance.strategyVersion !== binding.strategyVersion) issues.push("strategy-version-mismatch");

  const symSet = new Set(binding.symbolsAllowed);
  const tfSet = new Set(binding.timeframesAllowed);
  const scopeMismatch = instance.symbolScope.some((s) => !symSet.has(s));
  const tfMismatch = instance.timeframeScope.some((t) => !tfSet.has(t));
  if (scopeMismatch) issues.push("symbol-scope-mismatch");
  if (tfMismatch) issues.push("timeframe-scope-mismatch");
  if (instance.riskProfile !== binding.riskProfile) issues.push("risk-profile-mismatch");
  if (binding.newsRestrictionStatus !== "Loaded") issues.push("news-restrictions-not-loaded");
  if (binding.bindingStatus !== "Bound") issues.push("binding-status-not-bound");

  return { ok: issues.length === 0, issues };
}

export function suspiciousBehavior(instance: Pick<EaInstance, "tradingEnabled" | "emergencyStopActive" | "symbolScope" | "strategyId">, input: { commandsOutsideStrategy: number; unauthorizedSymbols: number; excessiveFrequency: boolean; duplicateOrders: number }) {
  const flags: string[] = [];
  if (instance.emergencyStopActive) flags.push("trading-after-emergency-stop");
  if (!instance.tradingEnabled) flags.push("trading-while-disabled");
  if (!instance.strategyId && input.commandsOutsideStrategy > 0) flags.push("commands-without-strategy");
  if (input.commandsOutsideStrategy >= 2) flags.push("commands-outside-strategy");
  if (input.unauthorizedSymbols >= 1) flags.push("unauthorized-symbol");
  if (input.excessiveFrequency) flags.push("excessive-frequency");
  if (input.duplicateOrders >= 2) flags.push("duplicate-order-attempts");
  return { suspicious: flags.length > 0, flags };
}

export function buildWorkflow(instances: EaInstance[], latestDiagnostic: AiEaDiagnostic | null): EaMonitoringWorkflowNode[] {
  const total = instances.length;
  const offline = instances.filter((e) => e.connectionStatus === "Offline").length;
  const degraded = instances.filter((e) => e.connectionStatus === "Degraded" || e.bridgeStatus === "Degraded" || e.heartbeatStatus !== "Active").length;
  const avgDelayMs = total ? Math.round(instances.reduce((sum, e) => sum + e.averageLatencyMs, 0) / total) : 0;
  const latestFailure = instances.find((e) => e.lastError) ? `${instances.find((e) => e.lastError)!.eaId}: ${instances.find((e) => e.lastError)!.lastError}` : offline ? `Offline EAs: ${offline}` : "None";
  const ai = latestDiagnostic?.recommendedFix ?? "Prioritize heartbeat/bridge issues; validate bindings and reload risk rules before enabling execution.";

  const node = (title: EaMonitoringWorkflowNode["title"], status: EaMonitoringWorkflowNode["status"], eaCount: number, failedCount: number, delayMs: number, rec: string): EaMonitoringWorkflowNode => ({
    title,
    status,
    eaCount,
    failedCount,
    averageDelayMs: delayMs,
    latestFailure,
    aiRecommendation: rec
  });

  const healthyRatio = total ? 1 - offline / total : 1;
  const overall: EaMonitoringWorkflowNode["status"] = healthyRatio >= 0.9 ? "Healthy" : healthyRatio >= 0.8 ? "Watch" : healthyRatio >= 0.65 ? "Degraded" : "Critical";

  return [
    node("EA Registered", total ? "Healthy" : "Watch", total, 0, 60, "Validate EA identity, version, and environment tags."),
    node("Terminal Bound", overall, total, offline, 90, "Confirm terminal online status and correct binding."),
    node("Broker Account Linked", overall, total, instances.filter((e) => !e.accountTradingAllowed).length, 110, "Validate broker login and account permissions."),
    node("Strategy Bound", degraded ? "Watch" : "Healthy", total, instances.filter((e) => !e.strategyId).length, 140, "Ensure strategy assignment and version alignment."),
    node("Symbol Scope Loaded", degraded ? "Watch" : "Healthy", total, instances.filter((e) => e.symbolScope.length === 0).length, 160, "Load/validate symbol scope and timeframes."),
    node("Heartbeat Active", degraded ? "Degraded" : "Healthy", total, instances.filter((e) => e.heartbeatStatus !== "Active").length, 220, "Investigate missing heartbeats; restart session if safe."),
    node("Bridge Connected", degraded ? "Degraded" : "Healthy", total, instances.filter((e) => e.bridgeStatus !== "Connected").length, 240, "Validate bridge session and channel stability."),
    node("Risk Rules Loaded", instances.filter((e) => !e.riskRulesLoaded).length ? "Watch" : "Healthy", total, instances.filter((e) => !e.riskRulesLoaded).length, 260, "Reload risk rules and confirm restrictions loaded."),
    node("Command Channel Ready", instances.filter((e) => e.commandChannelStatus !== "Ready").length ? "Watch" : "Healthy", total, instances.filter((e) => e.commandChannelStatus !== "Ready").length, avgDelayMs, "Validate command delivery path and deduplication."),
    node("Execution Feedback Active", instances.filter((e) => e.executionFeedbackStatus !== "Ready").length ? "Watch" : "Healthy", total, instances.filter((e) => e.executionFeedbackStatus !== "Ready").length, avgDelayMs + 80, ai)
  ];
}


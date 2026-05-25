import type { FreezeState, HeartbeatLog, PressureLevel, TerminalStatusRecord, TerminalTone } from "../types/terminal-status.types";

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function classifyHeartbeat(delaySeconds: number): TerminalTone {
  if (delaySeconds <= 30) return "Healthy";
  if (delaySeconds <= 60) return "Watch";
  if (delaySeconds <= 120) return "Degraded";
  if (delaySeconds <= 300) return "Critical";
  return "Offline";
}

export function classifyResourcePressure(input: {
  cpuUsagePercent: number;
  memoryUsagePercent: number;
  diskUsagePercent: number;
  networkLatencyMs: number;
  packetLossPercent: number;
  logFileSizeMb: number;
}) {
  const score = clamp(
    input.cpuUsagePercent * 0.22 +
    input.memoryUsagePercent * 0.3 +
    input.diskUsagePercent * 0.15 +
    Math.min(input.networkLatencyMs / 5, 20) +
    Math.min(input.packetLossPercent * 3, 10) +
    Math.min(input.logFileSizeMb / 100, 5)
  );
  const level: PressureLevel = score >= 80 ? "Critical" : score >= 60 ? "Degraded" : score >= 40 ? "Watch" : "Normal";
  return { score, level };
}

export function detectTerminalFreeze(terminal: TerminalStatusRecord): { state: FreezeState; restartRequired: boolean; reason: string } {
  const heartbeatStopped = terminal.heartbeatDelaySeconds > 60;
  const processAlive = terminal.processStatus === "Running";
  const tickFrozen = Date.now() - new Date(terminal.lastMarketTickAt).getTime() > 60_000;
  const accountFrozen = Date.now() - new Date(terminal.lastAccountUpdateAt).getTime() > 120_000;
  const logsFrozen = Date.now() - new Date(terminal.logsUpdatedAt).getTime() > 120_000;
  const resources = classifyResourcePressure(terminal);
  const signals = [heartbeatStopped, tickFrozen, accountFrozen, logsFrozen, resources.level === "Critical"].filter(Boolean).length;
  if (processAlive && signals >= 3) return { state: "Freeze Confirmed", restartRequired: true, reason: "Process is running but heartbeat, feed, or telemetry response has stopped." };
  if (processAlive && signals >= 2) return { state: "Freeze Suspected", restartRequired: false, reason: "Multiple telemetry streams show delayed progress." };
  return { state: "Clear", restartRequired: false, reason: "Terminal response signals are current." };
}

export function calculateTerminalHealthScore(terminal: TerminalStatusRecord) {
  const resource = classifyResourcePressure(terminal);
  const processScore = terminal.processStatus === "Running" ? 17 : terminal.processStatus === "Unresponsive" ? 5 : 0;
  const heartbeatScore = terminal.heartbeatStatus === "Healthy" ? 18 : terminal.heartbeatStatus === "Watch" ? 13 : terminal.heartbeatStatus === "Degraded" ? 7 : 0;
  const brokerConnectionScore = terminal.connectionStatus === "Healthy" ? 16 : terminal.connectionStatus === "Watch" ? 10 : 0;
  const resourceScore = Math.max(0, 16 - resource.score * 0.16);
  const marketDataScore = terminal.marketDataActive ? 13 : 0;
  const tradingReadinessScore = terminal.tradingEnabled && terminal.accountTradeAllowed && terminal.orderGatewayConnected && terminal.riskEngineConnected ? 20 : terminal.riskEngineConnected ? 8 : 0;
  const errorPenalty = terminal.lastErrorCode ? 8 : 0;
  const restartPenalty = Math.min(12, terminal.restartAttemptCount * 4);
  const score = clamp(processScore + heartbeatScore + brokerConnectionScore + resourceScore + marketDataScore + tradingReadinessScore - errorPenalty - restartPenalty);
  const rating = score >= 90 ? "Excellent" : score >= 75 ? "Healthy" : score >= 60 ? "Degraded" : score >= 40 ? "High Risk" : "Critical";
  return { score, rating, resourcePressure: resource };
}

export function evaluateSafeRestart(terminal: TerminalStatusRecord, riskEngineApproved = true) {
  const blockers: string[] = [];
  if (terminal.highRiskTradeInProgress) blockers.push("High-risk trade operation is in progress.");
  if (terminal.pendingOrdersCount > 0) blockers.push("Pending order submission exists.");
  if (terminal.accountSyncInProgress) blockers.push("Account synchronization is running.");
  if (!terminal.autoRestartEnabled) blockers.push("Auto-restart is disabled.");
  if (terminal.restartAttemptCount >= terminal.restartAttemptLimit) blockers.push("Restart attempt limit reached.");
  if (!riskEngineApproved) blockers.push("Risk engine approval was not granted.");
  const confirmedFailure = terminal.restartRequired || terminal.riskLevel === "Critical" || terminal.heartbeatStatus === "Offline";
  if (!confirmedFailure) blockers.push("Failure severity is not confirmed.");
  return { safe: blockers.length === 0, blockers };
}

export function predictTerminalFailure(terminal: TerminalStatusRecord, heartbeatHistory: HeartbeatLog[]) {
  const resource = classifyResourcePressure(terminal);
  const recentDelay = heartbeatHistory.filter((log) => log.terminalId === terminal.terminalId).slice(0, 5).reduce((sum, log) => sum + log.delaySeconds, 0) / Math.max(1, heartbeatHistory.filter((log) => log.terminalId === terminal.terminalId).slice(0, 5).length);
  const probability = clamp(
    resource.score * 0.38 +
    Math.min(terminal.heartbeatDelaySeconds / 3, 35) +
    Math.min(recentDelay / 5, 12) +
    terminal.missedHeartbeatCount * 4 +
    terminal.restartAttemptCount * 3 +
    (terminal.lastErrorCode ? 8 : 0)
  );
  return { probability, severity: probability >= 75 ? "Critical" as const : probability >= 45 ? "Warning" as const : "Info" as const };
}

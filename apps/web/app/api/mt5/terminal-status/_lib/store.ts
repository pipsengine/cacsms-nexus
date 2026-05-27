import type { AuditRecord, Mt5Role } from "@/modules/mt5-infrastructure-and-broker-connectivity/mt5-control-center/types/mt5-control-center.types";
import type { Terminal } from "@/modules/mt5-infrastructure-and-broker-connectivity/mt5-control-center/types/mt5-control-center.types";
import type { TerminalHeartbeatPayload } from "@/modules/mt5-infrastructure-and-broker-connectivity/ea-bridge/types/ea-bridge.types";
import {
  calculateTerminalHealthScore,
  classifyHeartbeat,
  classifyResourcePressure,
  detectTerminalFreeze,
  evaluateSafeRestart,
  predictTerminalFailure
} from "@/modules/mt5-infrastructure-and-broker-connectivity/terminal-status/algorithms/terminal-status.algorithms";
import type {
  TerminalAiDiagnostic,
  TerminalErrorLog,
  TerminalEvent,
  TerminalStatusRecord,
  TerminalStatusResponse,
  TerminalTone
} from "@/modules/mt5-infrastructure-and-broker-connectivity/terminal-status/types/terminal-status.types";
import { resolveMt5Role } from "../../_lib/access";
import { bindPersistedMt5State, ensureMt5ModuleHydrated } from "../../_lib/persistence";

const state = bindPersistedMt5State("terminal-status", () => ({
  terminals: [] as TerminalStatusRecord[],
  heartbeatLogs: [] as any[],
  events: [] as TerminalEvent[],
  errors: [] as TerminalErrorLog[],
  diagnostics: [] as TerminalAiDiagnostic[],
  audits: [] as AuditRecord[],
  lastSyncAt: new Date().toISOString()
}));

await ensureMt5ModuleHydrated("terminal-status");

export function resetTerminalStatusState(override?: Partial<typeof state>) {
  state.terminals = override?.terminals ?? [];
  state.heartbeatLogs = (override as any)?.heartbeatLogs ?? [];
  state.events = override?.events ?? [];
  state.errors = override?.errors ?? [];
  state.diagnostics = override?.diagnostics ?? [];
  state.audits = [];
  state.lastSyncAt = new Date().toISOString();
}

export function terminalStatusRole(request?: Request): Mt5Role {
  return resolveMt5Role(request);
}

const allowed: Record<string, Mt5Role[]> = {
  sync: ["Super Admin", "Infrastructure Admin"],
  healthCheck: ["Super Admin", "Infrastructure Admin"],
  restart: ["Super Admin", "Infrastructure Admin"],
  disableTrading: ["Super Admin", "Trading Admin"],
  enableTrading: ["Super Admin", "Trading Admin"],
  maintenance: ["Super Admin", "Infrastructure Admin"],
  autoRemediate: ["Super Admin", "Infrastructure Admin"]
};

function authorize(role: Mt5Role, action: keyof typeof allowed) {
  if (!allowed[action].includes(role)) throw new Error(`Role "${role}" is not authorized to perform terminal ${action}.`);
}

function confirmAction(confirmed?: boolean) {
  if (!confirmed) throw new Error("Confirmation is required for this restricted terminal action.");
}

function audit(role: Mt5Role, action: string, entityId: string, oldValue: unknown, newValue: unknown, request?: Request) {
  state.audits.unshift({
    id: `terminal-audit-${Date.now()}-${state.audits.length}`, userId: request?.headers.get("x-user-id") ?? role.toLowerCase().replace(/\s+/g, "-"),
    action, module: "Terminal Status", entityId, oldValue, newValue, ipAddress: request?.headers.get("x-forwarded-for") ?? "system",
    userAgent: request?.headers.get("user-agent") ?? "autonomous-terminal-monitor", timestamp: new Date().toISOString()
  });
}

function terminalById(terminalId: string) {
  const terminal = state.terminals.find((item) => item.terminalId === terminalId);
  if (!terminal) throw new Error("MT5 terminal status not found.");
  return terminal;
}

function refreshedTerminal(terminal: TerminalStatusRecord) {
  terminal.heartbeatDelaySeconds = Math.max(0, Math.round((Date.now() - new Date(terminal.lastHeartbeatAt).getTime()) / 1000));
  terminal.heartbeatStatus = classifyHeartbeat(terminal.heartbeatDelaySeconds);
  const freeze = detectTerminalFreeze(terminal);
  if (freeze.restartRequired) terminal.restartRequired = true;
  const health = calculateTerminalHealthScore(terminal);
  terminal.healthScore = health.score;
  if (terminal.maintenanceMode) terminal.riskLevel = "Inactive";
  else terminal.riskLevel = health.score >= 75 ? "Healthy" : health.score >= 60 ? "Degraded" : health.score >= 40 ? "Critical" : "Critical";
  return terminal;
}

function records() {
  return state.terminals.map(refreshedTerminal);
}

function addEvent(terminal: TerminalStatusRecord, eventType: string, severity: TerminalEvent["severity"], triggeredBy: string, actionTaken: string, result: string, message: string) {
  state.events.unshift({
    id: `te-${Date.now()}-${state.events.length}`, terminalId: terminal.terminalId, terminalName: terminal.terminalName, eventType, severity,
    sourceModule: "Terminal Status", message, previousStatus: terminal.riskLevel, newStatus: terminal.riskLevel, triggeredBy, actionTaken, result, autoResolved: result === "Completed", createdAt: new Date().toISOString()
  });
}

export function terminalRecords() { return records(); }

export function removeTerminalMonitorByUuid(terminalUuid: string) {
  const normalized = terminalUuid.trim().toUpperCase();
  if (!normalized) return 0;
  const removedIds = new Set<string>();
  const before = state.terminals.length;
  state.terminals = state.terminals.filter((terminal) => {
    const matches = terminal.terminalUuid === normalized || terminal.terminalId === normalized || terminal.id === `status-${normalized}`;
    if (matches) removedIds.add(terminal.terminalId);
    return !matches;
  });
  if (!removedIds.size) return 0;
  state.events = state.events.filter((event) => !removedIds.has(event.terminalId));
  state.errors = state.errors.filter((error) => !removedIds.has(error.terminalId));
  state.heartbeatLogs = state.heartbeatLogs.filter((heartbeat) => !removedIds.has(heartbeat.terminalId));
  return before - state.terminals.length;
}

export function terminalRecord(terminalId: string) { return refreshedTerminal(terminalById(terminalId)); }
export function terminalLogs(terminalId?: string) { return terminalId ? state.errors.filter((error) => error.terminalId === terminalId) : state.errors; }
export function terminalEvents(terminalId?: string) { return terminalId ? state.events.filter((event) => event.terminalId === terminalId) : state.events; }
export function terminalHeartbeats(terminalId: string) { return state.heartbeatLogs.filter((heartbeat) => heartbeat.terminalId === terminalId); }
export function terminalAudits() { return state.audits; }

export function updateTerminalMonitorPaths(terminalId: string, mt5DataPath: string, terminalPath?: string) {
  const terminal = state.terminals.find((item) => item.terminalId === terminalId);
  if (!terminal) return null;
  terminal.mt5DataPath = mt5DataPath;
  if (terminalPath) terminal.terminalPath = terminalPath;
  terminal.updatedAt = new Date().toISOString();
  return terminal;
}

export function provisionTerminalMonitor(input: {
  terminal: Terminal;
  accountId: string;
  currency: string;
  ipAddress?: string;
  operatingSystem?: string;
  region?: string;
  timezone?: string;
  terminalPath?: string;
  mt5DataPath?: string;
}, role: Mt5Role, request?: Request) {
  if (!["Super Admin", "Infrastructure Admin"].includes(role)) throw new Error(`Role "${role}" is not authorized to provision terminal monitor.`);
  if (state.terminals.some((terminal) => terminal.terminalId === input.terminal.id || terminal.terminalUuid === input.terminal.terminalUuid)) {
    throw new Error("Duplicate terminal monitoring registration.");
  }
  const now = new Date().toISOString();
  const terminal: TerminalStatusRecord = {
    id: `status-${input.terminal.id}`, terminalId: input.terminal.id, terminalUuid: input.terminal.terminalUuid, terminalName: input.terminal.terminalName,
    brokerId: input.terminal.brokerId, brokerName: input.terminal.brokerName, accountId: input.accountId, accountLogin: input.terminal.accountLogin,
    accountType: input.terminal.accountType, accountCurrency: input.currency, serverName: input.terminal.serverName, hostMachine: input.terminal.hostMachine,
    ipAddress: input.ipAddress ?? "Pending verification", operatingSystem: input.operatingSystem ?? "Unknown", region: input.region ?? "Unassigned",
    timezone: input.timezone ?? "UTC", terminalPath: input.terminalPath ?? "Pending terminal installation",
    mt5DataPath: input.mt5DataPath?.trim() || null, terminalVersion: input.terminal.terminalVersion,
    buildNumber: 0, processStatus: "Stopped", processId: null, startupTime: now, connectionStatus: "Syncing", heartbeatStatus: "Syncing",
    lastHeartbeatAt: now, expectedHeartbeatIntervalSeconds: 15, heartbeatDelaySeconds: 0, missedHeartbeatCount: 0, cpuUsagePercent: 0,
    memoryUsagePercent: 0, diskUsagePercent: 0, networkLatencyMs: 0, packetLossPercent: 0, logFileSizeMb: 0, dataFolderSizeMb: 0,
    uptimeSeconds: 0, tradingEnabled: false, expertAdvisorsEnabled: false, dllImportsEnabled: false, accountTradeAllowed: false,
    marketDataActive: false, symbolMappingsValid: false, orderGatewayConnected: false, riskEngineConnected: true, openPositionsCount: 0,
    pendingOrdersCount: 0, lastErrorCode: null, lastErrorMessage: "Awaiting first signed EA heartbeat.", riskLevel: "Syncing", healthScore: 0,
    restartRequired: false, autoRestartEnabled: true, maintenanceMode: false, restartAttemptCount: 0, restartAttemptLimit: 3,
    highRiskTradeInProgress: false, accountSyncInProgress: false, lastMarketTickAt: now, lastAccountUpdateAt: now, logsUpdatedAt: now, updatedAt: now
  };
  state.terminals.push(terminal);
  addEvent(terminal, "Terminal provisioned", "Info", role, "Await signed heartbeat", "In progress", "Terminal onboarding created monitoring state with trading disabled.");
  audit(role, "Terminal monitor provisioned", terminal.terminalId, null, { accountId: terminal.accountId, tradingEnabled: false }, request);
  return terminal;
}

export function recordVerifiedTerminalHeartbeat(terminalId: string, payload: TerminalHeartbeatPayload, receivedAt: string) {
  const terminal = terminalById(terminalId);
  const awaitingActivation = terminal.processStatus !== "Running";
  terminal.terminalName = payload.terminalName || terminal.terminalName;
  terminal.processStatus = "Running";
  terminal.connectionStatus = payload.brokerConnected ? "Healthy" : "Degraded";
  terminal.heartbeatStatus = "Healthy";
  terminal.lastHeartbeatAt = receivedAt;
  terminal.heartbeatDelaySeconds = 0;
  terminal.networkLatencyMs = payload.latencyMs;
  terminal.marketDataActive = payload.marketDataActive;
  terminal.expertAdvisorsEnabled = true;
  terminal.lastErrorCode = null;
  terminal.lastErrorMessage = payload.brokerConnected ? null : "EA heartbeat verified, but broker session is disconnected.";
  terminal.updatedAt = receivedAt;
  state.heartbeatLogs.unshift({
    id: `hb-live-${Date.now()}`, terminalId, heartbeatReceivedAt: receivedAt, expectedIntervalSeconds: terminal.expectedHeartbeatIntervalSeconds,
    delaySeconds: 0, status: "Healthy", cpuUsagePercent: terminal.cpuUsagePercent, memoryUsagePercent: terminal.memoryUsagePercent,
    diskUsagePercent: terminal.diskUsagePercent, networkLatencyMs: payload.latencyMs, processRunning: true,
    brokerConnected: payload.brokerConnected, marketDataActive: payload.marketDataActive, tradingEnabled: false
  });
  if (awaitingActivation) {
    addEvent(terminal, "Verified heartbeat received", "Info", "EA Bridge", "Activate autonomous monitoring", "Completed", "Signed terminal heartbeat activated monitoring; trading remains disabled.");
  }
  return refreshedTerminal(terminal);
}

export function syncTerminalStatus(role: Mt5Role, confirmed: boolean, request?: Request) {
  authorize(role, "sync");
  confirmAction(confirmed);
  state.lastSyncAt = new Date().toISOString();
  audit(role, "Terminal status synchronized", "all-terminals", null, { count: state.terminals.length, synchronizedAt: state.lastSyncAt }, request);
  return records();
}

export function syncTerminalAccount(terminalId: string, role: Mt5Role, confirmed: boolean, request?: Request) {
  authorize(role, "sync");
  confirmAction(confirmed);
  const terminal = terminalRecord(terminalId);
  terminal.accountSyncInProgress = false;
  terminal.lastAccountUpdateAt = new Date().toISOString();
  addEvent(terminal, "Account sync", "Info", role, "Account snapshot synchronized", "Completed", "Account state refreshed for terminal.");
  audit(role, "Terminal account sync", terminalId, null, { accountId: terminal.accountId, synchronizedAt: terminal.lastAccountUpdateAt }, request);
  return terminal;
}

export function syncTerminalSymbols(terminalId: string, role: Mt5Role, confirmed: boolean, request?: Request) {
  authorize(role, "sync");
  confirmAction(confirmed);
  const terminal = terminalRecord(terminalId);
  const old = terminal.symbolMappingsValid;
  if (terminal.connectionStatus === "Healthy") terminal.symbolMappingsValid = true;
  addEvent(terminal, "Symbol sync", "Info", role, "Symbol mapping validation executed", "Completed", "Terminal symbol synchronization assessed.");
  audit(role, "Terminal symbol sync", terminalId, old, terminal.symbolMappingsValid, request);
  return terminal;
}

export function runTerminalHealthCheck(terminalId: string, role: Mt5Role, confirmed: boolean, request?: Request) {
  authorize(role, "healthCheck");
  confirmAction(confirmed);
  const terminal = terminalRecord(terminalId);
  const freeze = detectTerminalFreeze(terminal);
  const health = calculateTerminalHealthScore(terminal);
  const prediction = predictTerminalFailure(terminal, state.heartbeatLogs);
  audit(role, "Terminal health check", terminalId, null, { health, freeze, prediction }, request);
  addEvent(terminal, "Health check", health.score < 60 ? "Warning" : "Info", role, "Diagnostics executed", "Completed", `Health assessment completed with score ${health.score}.`);
  return { terminal, health, freeze, prediction };
}

export function restartTerminalStatus(terminalId: string, role: Mt5Role, confirmed: boolean, override = false, request?: Request) {
  authorize(role, "restart");
  confirmAction(confirmed);
  const terminal = terminalRecord(terminalId);
  const decision = evaluateSafeRestart(terminal);
  if (!decision.safe && !(override && role === "Super Admin")) throw new Error(`Safe restart blocked: ${decision.blockers.join(" ")}`);
  const old = { processStatus: terminal.processStatus, tradingEnabled: terminal.tradingEnabled, restartAttemptCount: terminal.restartAttemptCount };
  terminal.tradingEnabled = false;
  terminal.processStatus = "Running";
  terminal.processId = 9000 + terminal.restartAttemptCount;
  terminal.restartAttemptCount += 1;
  terminal.startupTime = new Date().toISOString();
  terminal.uptimeSeconds = 0;
  terminal.lastHeartbeatAt = new Date().toISOString();
  terminal.heartbeatDelaySeconds = 0;
  terminal.heartbeatStatus = "Syncing";
  terminal.connectionStatus = "Syncing";
  addEvent(terminal, "Terminal restart", "Warning", role, "Routing disabled; process restarted; awaiting authentication", "In progress", "Safe recovery sequence initiated.");
  audit(role, "Terminal restart", terminalId, old, terminal, request);
  return { terminal, workflow: ["Disable order routing", "Save terminal state", "Restart process", "Await heartbeat", "Re-authenticate account", "Re-sync symbols", "Validate trading before re-enable"] };
}

export function setTerminalTrading(terminalId: string, enabled: boolean, role: Mt5Role, confirmed: boolean, request?: Request) {
  authorize(role, enabled ? "enableTrading" : "disableTrading");
  confirmAction(confirmed);
  const terminal = terminalRecord(terminalId);
  if (enabled && (!terminal.marketDataActive || !terminal.accountTradeAllowed || !terminal.riskEngineConnected)) throw new Error("Trading cannot be enabled until market data, account, and risk validations pass.");
  const old = terminal.tradingEnabled;
  terminal.tradingEnabled = enabled;
  addEvent(terminal, enabled ? "Trading restored" : "Trading disabled", enabled ? "Info" : "Warning", role, enabled ? "Route enabled" : "Route blocked", "Completed", `Terminal trading ${enabled ? "enabled" : "disabled"}.`);
  audit(role, enabled ? "Trading enabled" : "Trading disabled", terminalId, old, enabled, request);
  return terminal;
}

export function setMaintenance(terminalId: string, enabled: boolean, role: Mt5Role, confirmed: boolean, request?: Request) {
  authorize(role, "maintenance");
  confirmAction(confirmed);
  const terminal = terminalRecord(terminalId);
  const old = terminal.maintenanceMode;
  terminal.maintenanceMode = enabled;
  if (enabled) terminal.tradingEnabled = false;
  addEvent(terminal, enabled ? "Maintenance mode enabled" : "Maintenance mode disabled", "Info", role, enabled ? "Trading blocked" : "Monitoring resumed", "Completed", `Maintenance mode ${enabled ? "enabled" : "disabled"}.`);
  audit(role, enabled ? "Maintenance mode enabled" : "Maintenance mode disabled", terminalId, old, enabled, request);
  return terminal;
}

export function terminalDiagnostics(): TerminalAiDiagnostic[] {
  return state.diagnostics.map((diagnostic) => {
    const prediction = predictTerminalFailure(terminalRecord(diagnostic.terminalId), state.heartbeatLogs);
    return { ...diagnostic, failureProbability: prediction.probability, severity: prediction.severity };
  });
}

export function autoRemediateTerminal(diagnosticId: string, role: Mt5Role, confirmed: boolean, request?: Request) {
  authorize(role, "autoRemediate");
  confirmAction(confirmed);
  const diagnostic = state.diagnostics.find((item) => item.id === diagnosticId);
  if (!diagnostic) throw new Error("Terminal AI diagnostic not found.");
  if (!diagnostic.autoFixEligible) throw new Error("Auto-fix is not eligible for this terminal issue.");
  const terminal = terminalRecord(diagnostic.terminalId);
  const decision = evaluateSafeRestart(terminal);
  if (!decision.safe) throw new Error(`Auto-restart blocked: ${decision.blockers.join(" ")}`);
  diagnostic.autoFixStatus = "Running";
  const recovery = restartTerminalStatus(terminal.terminalId, role, true, false, request);
  audit(role, "AI recommendation accepted", diagnosticId, "Available", "Running", request);
  return { diagnostic, recovery };
}

function aggregateTone(count: number, severe: number): TerminalTone {
  return severe > 0 ? "Critical" : count > 0 ? "Degraded" : "Healthy";
}

export function buildTerminalStatusResponse(role: Mt5Role = "Infrastructure Admin"): TerminalStatusResponse {
  const terminals = records();
  const now = new Date().toISOString();
  const average = (selector: (terminal: TerminalStatusRecord) => number) => Math.round(terminals.reduce((sum, terminal) => sum + selector(terminal), 0) / terminals.length);
  const offline = terminals.filter((terminal) => terminal.heartbeatStatus === "Offline").length;
  const critical = terminals.filter((terminal) => terminal.riskLevel === "Critical").length;
  const degraded = terminals.filter((terminal) => terminal.riskLevel === "Degraded" || terminal.heartbeatStatus === "Watch").length;
  const restart = terminals.filter((terminal) => terminal.restartRequired).length;
  const disabled = terminals.filter((terminal) => !terminal.tradingEnabled).length;
  const infraScore = average((terminal) => terminal.healthScore);
  const workflowTitles = ["Terminal Registered", "MT5 Process Running", "Broker Session Connected", "Account Authenticated", "Symbols Loaded", "Market Data Streaming", "Trading Permission Verified", "Heartbeat Active", "Execution Ready"];
  const stageChecks: Array<(terminal: TerminalStatusRecord) => boolean> = [
    () => true, (terminal) => terminal.processStatus === "Running", (terminal) => terminal.connectionStatus === "Healthy", (terminal) => terminal.accountTradeAllowed,
    (terminal) => terminal.symbolMappingsValid, (terminal) => terminal.marketDataActive, (terminal) => terminal.tradingEnabled,
    (terminal) => terminal.heartbeatStatus === "Healthy", (terminal) => terminal.orderGatewayConnected && terminal.tradingEnabled
  ];
  return {
    meta: { timestamp: now, currentRole: role, streamEndpoint: "/api/mt5/terminal-status/events-stream", monitoringMode: "Autonomous" },
    kpis: [
      { label: "Total Registered Terminals", value: String(terminals.length), status: "Healthy", trend: "Stable", detail: "Managed terminal inventory", updatedAt: now },
      { label: "Online Terminals", value: String(terminals.filter((terminal) => terminal.processStatus === "Running").length), status: "Healthy", trend: "Live", detail: "Process responding", updatedAt: now },
      { label: "Offline Terminals", value: String(offline), status: offline ? "Critical" : "Healthy", trend: offline ? "+1" : "Stable", detail: "Heartbeat over 300 seconds", updatedAt: now },
      { label: "Degraded Terminals", value: String(degraded), status: degraded ? "Degraded" : "Healthy", trend: degraded ? "Watch" : "Stable", detail: "Monitoring required", updatedAt: now },
      { label: "Critical Terminals", value: String(critical), status: critical ? "Critical" : "Healthy", trend: critical ? "Action" : "Stable", detail: "Recovery required", updatedAt: now },
      { label: "Average Heartbeat Delay", value: `${average((terminal) => terminal.heartbeatDelaySeconds)} s`, status: average((terminal) => terminal.heartbeatDelaySeconds) > 60 ? "Degraded" : "Healthy", trend: "Calculated", detail: "Across all terminals", updatedAt: now },
      { label: "Average CPU Usage", value: `${average((terminal) => terminal.cpuUsagePercent)}%`, status: average((terminal) => terminal.cpuUsagePercent) > 70 ? "Degraded" : "Healthy", trend: "Telemetry", detail: "Host process load", updatedAt: now },
      { label: "Average Memory Usage", value: `${average((terminal) => terminal.memoryUsagePercent)}%`, status: average((terminal) => terminal.memoryUsagePercent) > 70 ? "Degraded" : "Healthy", trend: "Telemetry", detail: "Terminal allocation", updatedAt: now },
      { label: "Terminals Requiring Restart", value: String(restart), status: restart ? "Critical" : "Healthy", trend: "AI flagged", detail: "Safe recovery candidate", updatedAt: now },
      { label: "Trading Disabled", value: String(disabled), status: disabled ? "Watch" : "Healthy", trend: "Protected", detail: "Blocked routes", updatedAt: now },
      { label: "Last Global Status Sync", value: new Date(state.lastSyncAt).toLocaleTimeString(), status: "Syncing", trend: "Current", detail: "Operational snapshot", updatedAt: now },
      { label: "Infrastructure Health Score", value: `${infraScore}/100`, status: infraScore >= 75 ? "Healthy" : infraScore >= 60 ? "Degraded" : "Critical", trend: infraScore < 60 ? "Falling" : "Stable", detail: "Weighted health model", updatedAt: now }
    ],
    workflow: workflowTitles.map((title, index) => {
      const count = terminals.filter(stageChecks[index]).length;
      const failedCount = terminals.length - count;
      return { title, status: aggregateTone(failedCount, index > 1 && failedCount > 1 ? failedCount : 0), count, failedCount, averageDelaySeconds: average((terminal) => terminal.heartbeatDelaySeconds), lastCheckedAt: now, aiRecommendation: failedCount ? "Review failed terminals and preserve trade blocks." : undefined };
    }),
    terminals,
    heartbeatLogs: state.heartbeatLogs,
    events: state.events,
    errors: state.errors,
    diagnostics: terminalDiagnostics(),
    audits: state.audits,
    resourceSummary: {
      averageCpu: average((terminal) => terminal.cpuUsagePercent), averageMemory: average((terminal) => terminal.memoryUsagePercent),
      averageDisk: average((terminal) => terminal.diskUsagePercent), averageLatency: average((terminal) => terminal.networkLatencyMs),
      pressureScore: average((terminal) => classifyResourcePressure(terminal).score)
    },
    permissions: {
      role, canSync: allowed.sync.includes(role), canRunHealthCheck: allowed.healthCheck.includes(role), canRestart: allowed.restart.includes(role),
      canTradeControl: allowed.disableTrading.includes(role), canMaintenance: allowed.maintenance.includes(role), canEmergencyDisable: role === "Super Admin",
      canAutoRemediate: allowed.autoRemediate.includes(role)
    }
  };
}

export function terminalResources(terminalId: string) {
  const terminal = terminalRecord(terminalId);
  return { terminalId, cpuUsagePercent: terminal.cpuUsagePercent, memoryUsagePercent: terminal.memoryUsagePercent, diskUsagePercent: terminal.diskUsagePercent, networkLatencyMs: terminal.networkLatencyMs, packetLossPercent: terminal.packetLossPercent, pressure: classifyResourcePressure(terminal) };
}

export function terminalSummary(role: Mt5Role) {
  const response = buildTerminalStatusResponse(role);
  return { meta: response.meta, kpis: response.kpis, workflow: response.workflow, resourceSummary: response.resourceSummary, permissions: response.permissions };
}

export function addSyntheticError(error: TerminalErrorLog) {
  state.errors.unshift(error);
}

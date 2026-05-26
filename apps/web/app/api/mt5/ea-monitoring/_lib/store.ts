import type { AuditRecord, Mt5Role, ScoreResult } from "@/modules/mt5-infrastructure-and-broker-connectivity/mt5-control-center/types/mt5-control-center.types";
import { createEaMonitoringSeed } from "@/modules/mt5-infrastructure-and-broker-connectivity/ea-monitoring/data/ea-monitoring.mock";
import type {
  ActionResponse,
  AiDiagnosticsResponse,
  AnalyticsResponse,
  AuditResponse,
  CommandsResponse,
  EaInstance,
  EaMonitoringSummaryResponse,
  ExceptionsResponse,
  ExportRequest,
  InstanceResponse,
  InstancesResponse,
  LogsResponse,
  RebindStrategyRequest,
  RebindTerminalRequest,
  StrategyBindingsResponse,
  WorkflowResponse
} from "@/modules/mt5-infrastructure-and-broker-connectivity/ea-monitoring/types/ea-monitoring.types";
import { buildWorkflow, eaHealthScore, readinessValidation, strategyBindingIntegrity, suspiciousBehavior } from "@/modules/mt5-infrastructure-and-broker-connectivity/ea-monitoring/algorithms/ea-monitoring.algorithms";
import { resolveMt5Role } from "../../_lib/access";

const seed = createEaMonitoringSeed();

type EaMonitoringState = {
  instances: EaInstance[];
  commands: ReturnType<typeof createEaMonitoringSeed>["commands"];
  bindings: ReturnType<typeof createEaMonitoringSeed>["bindings"];
  logs: ReturnType<typeof createEaMonitoringSeed>["logs"];
  exceptions: ReturnType<typeof createEaMonitoringSeed>["exceptions"];
  analytics: ReturnType<typeof createEaMonitoringSeed>["analytics"];
  diagnostics: ReturnType<typeof createEaMonitoringSeed>["diagnostics"];
  audit: AuditRecord[];
  lastSyncAt: string;
};

const state: EaMonitoringState = {
  instances: seed.instances,
  commands: seed.commands,
  bindings: seed.bindings,
  logs: seed.logs,
  exceptions: seed.exceptions,
  analytics: seed.analytics,
  diagnostics: seed.diagnostics,
  audit: [],
  lastSyncAt: new Date().toISOString()
};

export function resetEaMonitoringState() {
  const next = createEaMonitoringSeed();
  state.instances = next.instances;
  state.commands = next.commands;
  state.bindings = next.bindings;
  state.logs = next.logs;
  state.exceptions = next.exceptions;
  state.analytics = next.analytics;
  state.diagnostics = next.diagnostics;
  state.audit = [];
  state.lastSyncAt = new Date().toISOString();
}

const permissions: Record<string, Mt5Role[]> = {
  sync: ["Super Admin", "Infrastructure Admin", "Trading Admin"],
  diagnostics: ["Super Admin", "Infrastructure Admin", "Trading Admin", "Risk Manager", "Analyst"],
  restart: ["Super Admin", "Infrastructure Admin"],
  toggleTrading: ["Super Admin", "Trading Admin"],
  rebind: ["Super Admin", "Infrastructure Admin"],
  remediate: ["Super Admin"],
  export: ["Super Admin", "Infrastructure Admin", "Trading Admin", "Risk Manager", "Analyst", "Read-Only Viewer"]
};

export function eaMonitoringRole(request?: Request): Mt5Role {
  return resolveMt5Role(request);
}

function authorize(role: Mt5Role, action: keyof typeof permissions) {
  if (!permissions[action].includes(role)) throw new Error(`Role "${role}" is not authorized to perform EA Monitoring ${action}.`);
}

function audit(role: Mt5Role, action: string, entityId: string, oldValue: unknown, newValue: unknown, request?: Request) {
  state.audit.unshift({
    id: `ea-audit-${Date.now()}-${state.audit.length}`,
    userId: request?.headers.get("x-user-id") ?? role.toLowerCase().replace(/\s+/g, "-"),
    action,
    module: "EA Monitoring",
    entityId,
    oldValue,
    newValue,
    ipAddress: request?.headers.get("x-forwarded-for") ?? "system",
    userAgent: request?.headers.get("user-agent") ?? "autonomous-ea-monitoring",
    timestamp: new Date().toISOString()
  });
}

function findInstance(eaId: string) {
  const inst = state.instances.find((e) => e.eaId === eaId || e.id === eaId);
  if (!inst) throw new Error("not found");
  return inst;
}

function refreshDerived() {
  for (const inst of state.instances) {
    inst.readiness = readinessValidation(inst);
    const binding = inst.strategyId ? state.bindings.find((b) => b.eaId === inst.eaId) ?? null : null;
    const integrity = strategyBindingIntegrity(inst, binding);
    const errFreq = inst.failedCommands >= 6 ? 2 : inst.failedCommands >= 3 ? 1 : 0;
    inst.healthScore = eaHealthScore({
      heartbeatDelaySeconds: inst.heartbeatDelaySeconds,
      heartbeatStatus: inst.heartbeatStatus,
      bridgeStatus: inst.bridgeStatus,
      strategyBindingOk: integrity.ok,
      commandSuccessRate: inst.commandSuccessRate,
      executionFeedbackStatus: inst.executionFeedbackStatus,
      riskRulesLoaded: inst.riskRulesLoaded,
      riskLevel: inst.riskLevel,
      restartCount: inst.restartCount,
      errorFrequency: errFreq
    });
  }
}

function computeHealthScore(): ScoreResult {
  refreshDerived();
  const total = state.instances.length;
  const avg = Math.round(state.instances.reduce((sum, e) => sum + e.healthScore, 0) / Math.max(1, total));
  const offline = state.instances.filter((e) => e.connectionStatus === "Offline").length;
  const degraded = state.instances.filter((e) => e.connectionStatus === "Degraded" || e.bridgeStatus === "Degraded" || e.heartbeatStatus !== "Active").length;
  const failedCommands = state.instances.reduce((sum, e) => sum + e.failedCommands, 0);
  const rating =
    avg >= 90 ? "Excellent" :
    avg >= 75 ? "Healthy" :
    avg >= 60 ? "Degraded" :
    avg >= 40 ? "High Risk" :
    "Critical";
  return { score: avg, rating, factors: { offline, degraded, failedCommands } };
}

export function summary(role: Mt5Role): EaMonitoringSummaryResponse {
  const now = new Date().toISOString();
  refreshDerived();

  const total = state.instances.length;
  const active = state.instances.filter((e) => e.connectionStatus === "Online").length;
  const offline = state.instances.filter((e) => e.connectionStatus === "Offline").length;
  const degraded = state.instances.filter((e) => e.connectionStatus === "Degraded" || e.bridgeStatus === "Degraded" || e.heartbeatStatus !== "Active").length;
  const enabled = state.instances.filter((e) => e.tradingEnabled).length;
  const disabled = total - enabled;
  const avgHb = Math.round(state.instances.reduce((sum, e) => sum + e.heartbeatDelaySeconds, 0) / Math.max(1, total));
  const avgLatency = Math.round(state.instances.reduce((sum, e) => sum + e.averageLatencyMs, 0) / Math.max(1, total));
  const failedCmds = state.instances.reduce((sum, e) => sum + e.failedCommands, 0);
  const throughput = Math.round(state.commands.length / 5);
  const highest = [...state.instances].sort((a, b) => (b.riskLevel === "Critical" ? 1 : 0) - (a.riskLevel === "Critical" ? 1 : 0) || b.failedCommands - a.failedCommands)[0];
  const health = computeHealthScore();

  const status = (value: number, warn: number, crit: number) => (value >= crit ? "Critical" : value >= warn ? "Degraded" : "Healthy");

  const kpis: EaMonitoringSummaryResponse["kpis"] = [
    { label: "Total EA Instances", value: String(total), status: "Healthy", detail: `Last sync: ${state.lastSyncAt}`, updatedAt: now },
    { label: "Active EAs", value: String(active), status: active >= total * 0.85 ? "Healthy" : "Watch", detail: "Online EAs with active connectivity.", updatedAt: now },
    { label: "Offline EAs", value: String(offline), status: offline >= 6 ? "Critical" : offline >= 3 ? "Degraded" : offline >= 1 ? "Watch" : "Healthy", detail: "EAs with no heartbeat/connection.", updatedAt: now },
    { label: "Degraded EAs", value: String(degraded), status: degraded >= 10 ? "Degraded" : degraded >= 5 ? "Watch" : "Healthy", detail: "Degraded heartbeat, bridge, or channels.", updatedAt: now },
    { label: "Trading Enabled EAs", value: String(enabled), status: "Healthy", detail: "EAs allowed to trade under risk controls.", updatedAt: now },
    { label: "Trading Disabled EAs", value: String(disabled), status: disabled >= 10 ? "Watch" : "Healthy", detail: "Trading disabled by operator/rules.", updatedAt: now },
    { label: "Average EA Heartbeat Delay", value: `${avgHb}s`, status: avgHb >= 12 ? "Degraded" : avgHb >= 7 ? "Watch" : "Healthy", detail: "Average heartbeat delay across EAs.", updatedAt: now },
    { label: "Average Command Latency", value: `${avgLatency}ms`, status: avgLatency >= 900 ? "Degraded" : avgLatency >= 600 ? "Watch" : "Healthy", detail: "Average end-to-end command latency.", updatedAt: now },
    { label: "Failed Commands", value: String(failedCmds), status: status(failedCmds, 25, 60), detail: "Command delivery/execution failures.", updatedAt: now },
    { label: "Message Throughput", value: `${throughput}/min`, status: throughput >= 200 ? "Healthy" : throughput >= 120 ? "Watch" : "Degraded", detail: "Command + heartbeat message throughput.", updatedAt: now },
    { label: "Highest Risk EA", value: highest?.eaId ?? "—", status: highest?.riskLevel === "Critical" ? "Critical" : highest?.riskLevel === "High" ? "Degraded" : "Watch", detail: highest?.lastError ?? "Highest risk based on readiness and failures.", updatedAt: now },
    { label: "EA Health Score", value: `${health.score}/100`, status: health.rating === "Critical" ? "Critical" : health.rating === "High Risk" ? "Degraded" : health.rating === "Degraded" ? "Watch" : "Healthy", detail: "Composite EA health score across readiness and failures.", updatedAt: now }
  ];

  return { meta: { timestamp: now, currentRole: role, streamEndpoint: "/api/mt5/ea-monitoring/events-stream" }, kpis, eaHealthScore: health };
}

export function workflow(): WorkflowResponse {
  refreshDerived();
  const wf = buildWorkflow(state.instances, state.diagnostics[0] ?? null);
  return { meta: { timestamp: new Date().toISOString() }, workflow: wf };
}

export function listInstances(input: { search?: string; status?: string; risk?: string; trading?: string; page?: number; pageSize?: number }): InstancesResponse {
  const search = input.search?.trim().toLowerCase() ?? "";
  const page = input.page ?? 1;
  const pageSize = input.pageSize ?? 75;
  const filtered = state.instances.filter((e) => {
    const matchesSearch =
      !search ||
      [
        e.eaId,
        e.eaName,
        e.eaVersion,
        e.buildNumber,
        e.terminal,
        e.broker,
        e.accountLogin,
        e.strategyName ?? "",
        e.symbolScope.join(","),
        e.connectionStatus,
        e.heartbeatStatus,
        e.bridgeStatus,
        e.lastError ?? "",
        e.riskLevel
      ]
        .join(" ")
        .toLowerCase()
        .includes(search);

    const matchesStatus = input.status ? e.connectionStatus === input.status : true;
    const matchesRisk = input.risk ? e.riskLevel === input.risk : true;
    const matchesTrading = input.trading ? (input.trading === "enabled" ? e.tradingEnabled : !e.tradingEnabled) : true;
    return matchesSearch && matchesStatus && matchesRisk && matchesTrading;
  });

  const sorted = [...filtered].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const start = (page - 1) * pageSize;
  return { meta: { timestamp: new Date().toISOString(), total: filtered.length, page, pageSize }, instances: sorted.slice(start, start + pageSize) };
}

export function instanceDetail(eaId: string): InstanceResponse {
  return { meta: { timestamp: new Date().toISOString() }, instance: findInstance(eaId) };
}

export function commands(input: { search?: string; page?: number; pageSize?: number }): CommandsResponse {
  const search = input.search?.trim().toLowerCase() ?? "";
  const page = input.page ?? 1;
  const pageSize = input.pageSize ?? 75;
  const filtered = state.commands.filter((c) => !search || [c.commandId, c.eaId, c.eaInstance, c.strategyName ?? "", c.account, c.broker, c.symbol, c.commandType, c.commandStatus, c.failureReason ?? ""].join(" ").toLowerCase().includes(search));
  const sorted = [...filtered].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const start = (page - 1) * pageSize;
  return { meta: { timestamp: new Date().toISOString(), total: filtered.length, page, pageSize }, commands: sorted.slice(start, start + pageSize) };
}

export function strategyBindings(): StrategyBindingsResponse {
  return { meta: { timestamp: new Date().toISOString(), total: state.bindings.length }, bindings: state.bindings };
}

export function logs(filter?: string): LogsResponse {
  const f = filter?.trim().toLowerCase() ?? "";
  const rows = f ? state.logs.filter((l) => [l.severity, l.errorType, l.message, l.eaId, l.terminal, l.broker, l.account, l.resolutionStatus].join(" ").toLowerCase().includes(f)) : state.logs;
  return { meta: { timestamp: new Date().toISOString(), total: rows.length }, logs: rows.slice(0, 300) };
}

export function exceptions(filter?: string): ExceptionsResponse {
  const f = filter?.trim().toLowerCase() ?? "";
  const rows = f ? state.exceptions.filter((e) => [e.exceptionType, e.severity, e.resolutionStatus, e.rootCause, e.aiExplanation, e.eaId, e.terminal, e.broker, e.account].join(" ").toLowerCase().includes(f)) : state.exceptions;
  return { meta: { timestamp: new Date().toISOString(), total: rows.length }, exceptions: rows.slice(0, 300) };
}

export function analytics(): AnalyticsResponse {
  return { meta: { timestamp: new Date().toISOString(), total: state.analytics.length }, points: state.analytics };
}

export function aiDiagnostics(): AiDiagnosticsResponse {
  refreshDerived();
  state.diagnostics = [];
  for (const inst of state.instances.slice(0, 30)) {
    if (!inst.readiness.executionReady || inst.riskLevel === "Critical" || inst.heartbeatStatus !== "Active") {
      state.diagnostics.push({
        id: `aid-${inst.eaId}`,
        eaId: inst.eaId,
        eaInstance: inst.eaName,
        issueSummary: inst.heartbeatStatus !== "Active" ? "EA heartbeat missing/delayed" : !inst.readiness.executionReady ? "EA not execution-ready" : "High-risk EA state detected",
        severity: inst.riskLevel === "Critical" || inst.connectionStatus === "Offline" ? "Critical" : inst.riskLevel === "High" ? "Warning" : "Info",
        rootCause: inst.lastError ?? inst.readiness.blockers.join(", "),
        tradingImpact: inst.tradingEnabled && !inst.readiness.executionReady ? "Trading path unsafe; disable trading until recovered." : "Operational degradation; may impact execution quality.",
        recommendedFix: inst.connectionStatus === "Offline" ? "Restart EA session; verify terminal heartbeat and bridge session." : !inst.riskRulesLoaded ? "Reload risk rules and confirm restrictions loaded." : "Rebind strategy/terminal if mismatch; verify command channel readiness.",
        autoRemediationEligible: inst.connectionStatus !== "Offline" && !inst.emergencyStopActive,
        confidenceScore: Math.max(0.35, Math.min(0.95, 0.55 + inst.healthScore / 200)),
        escalationRequired: inst.riskLevel === "Critical" || inst.emergencyStopActive || inst.connectionStatus === "Offline",
        createdAt: new Date().toISOString(),
        resolvedAt: null
      });
    }
  }
  return { meta: { timestamp: new Date().toISOString(), total: state.diagnostics.length }, diagnostics: state.diagnostics };
}

export function auditTrail(): AuditResponse {
  return { meta: { timestamp: new Date().toISOString(), total: state.audit.length }, audit: state.audit.slice(0, 400) };
}

export function sync(role: Mt5Role, request?: Request): ActionResponse {
  authorize(role, "sync");
  const before = { lastSyncAt: state.lastSyncAt };
  state.lastSyncAt = new Date().toISOString();
  const n = state.instances.length + 1;
  const inst = state.instances[0];
  if (inst) {
    inst.updatedAt = state.lastSyncAt;
    inst.heartbeatStatus = "Active";
    inst.connectionStatus = "Online";
    inst.lastHeartbeatAt = state.lastSyncAt;
    inst.heartbeatDelaySeconds = 2;
    inst.bridgeStatus = "Connected";
    inst.commandChannelStatus = "Ready";
    inst.executionFeedbackStatus = "Ready";
    inst.lastError = null;
  }
  refreshDerived();
  audit(role, "SYNC_EA_STATUS", "SYNC", before, { lastSyncAt: state.lastSyncAt }, request);
  return { meta: { timestamp: state.lastSyncAt }, ok: true, message: "Synced EA status.", affected: inst ? [inst.eaId] : [] };
}

export function diagnostics(role: Mt5Role, eaId: string | null, request?: Request): ActionResponse {
  authorize(role, "diagnostics");
  const targets = eaId ? [findInstance(eaId)] : state.instances.filter((e) => e.heartbeatStatus !== "Active" || e.connectionStatus !== "Online").slice(0, 6);
  aiDiagnostics();
  for (const t of targets) {
    audit(role, "RUN_EA_DIAGNOSTICS", t.eaId, null, { risk: t.riskLevel, blockers: t.readiness.blockers }, request);
  }
  return { meta: { timestamp: new Date().toISOString() }, ok: true, message: "EA diagnostics generated.", affected: targets.map((t) => t.eaId) };
}

export function restart(role: Mt5Role, eaId: string, request?: Request): ActionResponse {
  authorize(role, "restart");
  const inst = findInstance(eaId);
  const before = { connectionStatus: inst.connectionStatus, restartCount: inst.restartCount };
  inst.restartCount += 1;
  inst.connectionStatus = "Online";
  inst.heartbeatStatus = "Active";
  inst.lastHeartbeatAt = new Date().toISOString();
  inst.bridgeStatus = "Connected";
  inst.commandChannelStatus = "Ready";
  inst.executionFeedbackStatus = "Ready";
  inst.lastError = null;
  inst.updatedAt = new Date().toISOString();
  refreshDerived();
  audit(role, "RESTART_EA_SESSION", inst.eaId, before, { connectionStatus: inst.connectionStatus, restartCount: inst.restartCount }, request);
  return { meta: { timestamp: new Date().toISOString() }, ok: true, message: `Restarted EA session: ${inst.eaId}.`, affected: [inst.eaId] };
}

export function disableTrading(role: Mt5Role, eaId: string, request?: Request): ActionResponse {
  authorize(role, "toggleTrading");
  const inst = findInstance(eaId);
  const before = { tradingEnabled: inst.tradingEnabled };
  inst.tradingEnabled = false;
  inst.updatedAt = new Date().toISOString();
  refreshDerived();
  audit(role, "DISABLE_EA_TRADING", inst.eaId, before, { tradingEnabled: inst.tradingEnabled }, request);
  return { meta: { timestamp: new Date().toISOString() }, ok: true, message: `Disabled trading: ${inst.eaId}.`, affected: [inst.eaId] };
}

export function enableTrading(role: Mt5Role, eaId: string, request?: Request): ActionResponse {
  authorize(role, "toggleTrading");
  const inst = findInstance(eaId);
  const before = { tradingEnabled: inst.tradingEnabled };
  inst.tradingEnabled = true;
  inst.updatedAt = new Date().toISOString();
  refreshDerived();
  audit(role, "ENABLE_EA_TRADING", inst.eaId, before, { tradingEnabled: inst.tradingEnabled }, request);
  return { meta: { timestamp: new Date().toISOString() }, ok: true, message: `Enabled trading: ${inst.eaId}.`, affected: [inst.eaId] };
}

export function rebindStrategy(role: Mt5Role, eaId: string, payload: RebindStrategyRequest, request?: Request): ActionResponse {
  authorize(role, "rebind");
  const inst = findInstance(eaId);
  const before = { strategyId: inst.strategyId, strategyVersion: inst.strategyVersion };
  inst.strategyId = payload.strategyId;
  inst.strategyName = payload.strategyName;
  inst.strategyVersion = payload.strategyVersion;
  inst.updatedAt = new Date().toISOString();
  refreshDerived();
  audit(role, "REBIND_STRATEGY", inst.eaId, before, { strategyId: inst.strategyId, strategyVersion: inst.strategyVersion }, request);
  return { meta: { timestamp: new Date().toISOString() }, ok: true, message: `Rebound strategy: ${inst.eaId}.`, affected: [inst.eaId] };
}

export function rebindTerminal(role: Mt5Role, eaId: string, payload: RebindTerminalRequest, request?: Request): ActionResponse {
  authorize(role, "rebind");
  const inst = findInstance(eaId);
  const before = { terminalId: inst.terminalId };
  inst.terminalId = payload.terminalId;
  inst.terminal = payload.terminal;
  inst.updatedAt = new Date().toISOString();
  refreshDerived();
  audit(role, "REBIND_TERMINAL", inst.eaId, before, { terminalId: inst.terminalId }, request);
  return { meta: { timestamp: new Date().toISOString() }, ok: true, message: `Rebound terminal: ${inst.eaId}.`, affected: [inst.eaId] };
}

export function autoRemediate(role: Mt5Role, eaId: string, request?: Request): ActionResponse {
  authorize(role, "remediate");
  const inst = findInstance(eaId);
  const before = { connectionStatus: inst.connectionStatus, tradingEnabled: inst.tradingEnabled, riskRulesLoaded: inst.riskRulesLoaded };

  if (inst.emergencyStopActive) {
    audit(role, "AUTO_REMEDIATE_BLOCKED", inst.eaId, before, { reason: "emergency-stop-active" }, request);
    return { meta: { timestamp: new Date().toISOString() }, ok: false, message: "Auto-remediation blocked: emergency stop active.", affected: [inst.eaId] };
  }

  inst.riskRulesLoaded = true;
  inst.bridgeStatus = "Connected";
  inst.heartbeatStatus = "Active";
  inst.connectionStatus = "Online";
  inst.commandChannelStatus = "Ready";
  inst.executionFeedbackStatus = "Ready";
  inst.lastError = null;
  inst.updatedAt = new Date().toISOString();
  refreshDerived();
  audit(role, "AUTO_REMEDIATE", inst.eaId, before, { connectionStatus: inst.connectionStatus, riskRulesLoaded: inst.riskRulesLoaded }, request);
  return { meta: { timestamp: new Date().toISOString() }, ok: true, message: `Auto-remediation applied: ${inst.eaId}.`, affected: [inst.eaId] };
}

export function exportReport(payload: ExportRequest, role: Mt5Role, request?: Request): ActionResponse {
  authorize(role, "export");
  const before = { lastExportAt: null };
  const filtered = listInstances({
    search: payload.filters?.search,
    status: payload.filters?.status && payload.filters.status !== "all" ? payload.filters.status : undefined,
    risk: payload.filters?.risk && payload.filters.risk !== "all" ? payload.filters.risk : undefined,
    trading: payload.filters?.trading && payload.filters.trading !== "all" ? payload.filters.trading : undefined,
    page: 1,
    pageSize: 5000
  }).instances;
  const headers = [
    "eaId",
    "eaName",
    "eaVersion",
    "buildNumber",
    "terminal",
    "broker",
    "accountLogin",
    "strategyName",
    "connectionStatus",
    "heartbeatStatus",
    "bridgeStatus",
    "tradingEnabled",
    "commandSuccessRate",
    "failedCommands",
    "averageLatencyMs",
    "lastError",
    "riskLevel",
    "healthScore"
  ];
  const escape = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [headers.join(","), ...filtered.map((e) => headers.map((h) => escape((e as any)[h])).join(","))].join("\n");
  const json = JSON.stringify({ generatedAt: new Date().toISOString(), total: filtered.length, instances: filtered }, null, 2);
  audit(role, "EXPORT_EA_REPORT", "EXPORT", before, { format: payload.format, total: filtered.length }, request);
  return { meta: { timestamp: new Date().toISOString() }, ok: true, message: payload.format === "csv" ? csv : json };
}


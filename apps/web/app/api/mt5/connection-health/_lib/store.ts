import type { AuditRecord, Mt5Role } from "@/modules/mt5-infrastructure-and-broker-connectivity/mt5-control-center/types/mt5-control-center.types";
import {
  createPacketLossIncident,
  dependencyChainFailureDetection,
  deriveHeartbeatRows,
  infraRiskLevel,
  overallConnectionHealthScore,
  tradingPathSafety
} from "@/modules/mt5-infrastructure-and-broker-connectivity/connection-health/algorithms/connection-health.algorithms";
import {
  createMockComponents,
  createMockDependencyMap,
  createMockDiagnostics,
  createMockIncidents,
  createMockLatencyAndPacketLoss,
  createMockLogs,
  createMockWorkflow
} from "@/modules/mt5-infrastructure-and-broker-connectivity/connection-health/data/connection-health.mock";
import type {
  ActionResponse,
  AiConnectionDiagnostic,
  AiDiagnosticsResponse,
  ComponentResponse,
  ComponentsResponse,
  ConnectionComponent,
  ConnectionHealthSummaryResponse,
  ConnectionIncident,
  ConnectionLogEntry,
  DependencyMapResponse,
  HeartbeatsResponse,
  IncidentsResponse,
  LatencyResponse,
  PacketLossResponse,
  LogsResponse,
  WorkflowResponse
} from "@/modules/mt5-infrastructure-and-broker-connectivity/connection-health/types/connection-health.types";
import { resolveMt5Role } from "../../_lib/access";
import { bindPersistedMt5State } from "../../_lib/persistence";

const seed = () => {
  const components = createMockComponents();
  const map = createMockDependencyMap(components);
  const { latency, packetLoss } = createMockLatencyAndPacketLoss();
  return { components, dependencyMap: map, latency, packetLoss, workflow: createMockWorkflow(components), incidents: createMockIncidents(), logs: createMockLogs() };
};

const state = bindPersistedMt5State("connection-health", () => ({
  disabledUnsafeTrading: false,
  ...seed(),
  audits: [] as AuditRecord[]
}));

export function resetConnectionHealthState(override?: ReturnType<typeof seed>) {
  const next = override ?? seed();
  state.disabledUnsafeTrading = false;
  state.components = next.components;
  state.dependencyMap = next.dependencyMap;
  state.latency = next.latency;
  state.packetLoss = next.packetLoss;
  state.workflow = next.workflow;
  state.incidents = next.incidents;
  state.logs = next.logs;
  state.audits = [];
}

const permissions: Record<
  "diagnostics" | "reconnect" | "restart" | "disablePath" | "disableUnsafeTrading" | "autoRemediate",
  Mt5Role[]
> = {
  diagnostics: ["Super Admin", "Infrastructure Admin", "Analyst"],
  reconnect: ["Super Admin", "Infrastructure Admin"],
  restart: ["Super Admin", "Infrastructure Admin"],
  disablePath: ["Super Admin", "Trading Admin"],
  disableUnsafeTrading: ["Super Admin"],
  autoRemediate: ["Super Admin", "Infrastructure Admin"]
};

function authorize(role: Mt5Role, action: keyof typeof permissions) {
  if (!permissions[action].includes(role)) throw new Error(`Role "${role}" is not authorized to perform connection health ${action}.`);
}

function audit(role: Mt5Role, action: string, entityId: string, oldValue: unknown, newValue: unknown, request?: Request) {
  state.audits.unshift({
    id: `conn-audit-${Date.now()}-${state.audits.length}`,
    userId: request?.headers.get("x-user-id") ?? role.toLowerCase().replace(/\s+/g, "-"),
    action,
    module: "Connection Health",
    entityId,
    oldValue,
    newValue,
    ipAddress: request?.headers.get("x-forwarded-for") ?? "system",
    userAgent: request?.headers.get("user-agent") ?? "autonomous-connection-health",
    timestamp: new Date().toISOString()
  });
}

function addLog(entry: Omit<ConnectionLogEntry, "id">) {
  const next: ConnectionLogEntry = { id: `log-${Date.now()}-${state.logs.length}`, ...entry };
  state.logs.unshift(next);
  state.logs = state.logs.slice(0, 250);
  return next;
}

function action(ok: boolean, message: string, affectedComponentIds?: string[]): ActionResponse {
  return { meta: { timestamp: new Date().toISOString() }, ok, message, affectedComponentIds };
}

export function connectionHealthRole(request?: Request): Mt5Role {
  return resolveMt5Role(request);
}

function byId(componentId: string) {
  const component = state.components.find((c) => c.componentId === componentId);
  if (!component) throw new Error("Component not found.");
  return component;
}

function updateComponent(componentId: string, patch: Partial<ConnectionComponent>) {
  const idx = state.components.findIndex((c) => c.componentId === componentId);
  if (idx < 0) throw new Error("Component not found.");
  state.components[idx] = { ...state.components[idx], ...patch, updatedAt: new Date().toISOString() };
  return state.components[idx];
}

function recomputeWorkflowAndMap() {
  state.workflow = createMockWorkflow(state.components);
  if (state.components.length === 0) {
    state.dependencyMap = createMockDependencyMap(state.components);
  }
}

function applyDerivedIncidents() {
  const offenders = state.components.filter((c) => c.packetLossPercent >= 3);
  for (const c of offenders) {
    const existing = state.incidents.some((i) => i.componentId === c.componentId && i.incidentType === "Packet Loss" && i.resolutionStatus !== "Resolved");
    if (!existing) state.incidents.unshift(createPacketLossIncident(c, c.packetLossPercent));
  }
  state.incidents = state.incidents.slice(0, 150);
}

export function buildSummary(role: Mt5Role): ConnectionHealthSummaryResponse {
  recomputeWorkflowAndMap();
  applyDerivedIncidents();

  const dependencyPenalty = state.dependencyMap.edges.filter((e) => e.status !== "Healthy").length * 6;
  const overall = overallConnectionHealthScore(state.components, dependencyPenalty);
  const risk = infraRiskLevel(state.components, overall.score);
  const avgLatency = Math.round(state.components.reduce((sum, c) => sum + c.latencyMs, 0) / Math.max(1, state.components.length));
  const maxLatency = [...state.components].sort((a, b) => b.latencyMs - a.latencyMs)[0];
  const activeHeartbeats = state.components.filter((c) => c.heartbeatStatus === "Healthy" || c.heartbeatStatus === "Watch").length;
  const missedHeartbeats = state.components.filter((c) => c.heartbeatStatus === "Degraded" || c.heartbeatStatus === "Critical" || c.heartbeatStatus === "Offline").length;
  const marketFeedHealth = Math.round(
    state.components.filter((c) => c.componentType === "Market Data Feed").reduce((sum, c) => sum + c.healthScore, 0) /
      Math.max(1, state.components.filter((c) => c.componentType === "Market Data Feed").length)
  );
  const executionChannelHealth = Math.round(
    state.components.filter((c) => c.componentType === "EA Bridge" || c.componentType === "MT5 Feedback").reduce((sum, c) => sum + c.healthScore, 0) /
      Math.max(1, state.components.filter((c) => c.componentType === "EA Bridge" || c.componentType === "MT5 Feedback").length)
  );

  const healthy = state.components.filter((c) => c.connectionStatus === "Healthy").length;
  const degraded = state.components.filter((c) => c.connectionStatus === "Degraded" || c.connectionStatus === "Syncing").length;
  const critical = state.components.filter((c) => c.connectionStatus === "Critical").length;
  const offline = state.components.filter((c) => c.connectionStatus === "Offline").length;

  const kpis: ConnectionHealthSummaryResponse["kpis"] = [
    { label: "Overall Connection Health Score", value: `${overall.score}/100`, status: overall.score >= 75 ? "Healthy" : overall.score >= 60 ? "Degraded" : "Critical", detail: overall.rating, updatedAt: new Date().toISOString() },
    { label: "Healthy Services", value: String(healthy), status: "Healthy", detail: "Components operating normally", updatedAt: new Date().toISOString() },
    { label: "Degraded Services", value: String(degraded), status: degraded > 4 ? "Degraded" : "Watch", detail: "Components with elevated latency/packet loss", updatedAt: new Date().toISOString() },
    { label: "Critical Services", value: String(critical), status: critical > 0 ? "Critical" : "Healthy", detail: "Immediate attention required", updatedAt: new Date().toISOString() },
    { label: "Offline Services", value: String(offline), status: offline > 0 ? "Critical" : "Healthy", detail: "Disconnected components", updatedAt: new Date().toISOString() },
    { label: "Average Latency", value: `${avgLatency}ms`, status: avgLatency > 250 ? "Degraded" : avgLatency > 150 ? "Watch" : "Healthy", detail: "Average latency across components", updatedAt: new Date().toISOString() },
    { label: "Highest Latency Component", value: maxLatency?.componentName ?? "—", status: "Watch", detail: maxLatency ? `${maxLatency.latencyMs}ms` : "—", updatedAt: new Date().toISOString() },
    { label: "Active Heartbeats", value: String(activeHeartbeats), status: "Healthy", detail: "Healthy/watch heartbeat streams", updatedAt: new Date().toISOString() },
    { label: "Missed Heartbeats", value: String(missedHeartbeats), status: missedHeartbeats > 0 ? "Degraded" : "Healthy", detail: "Degraded/critical/offline heartbeats", updatedAt: new Date().toISOString() },
    { label: "Market Feed Health", value: `${marketFeedHealth}/100`, status: marketFeedHealth >= 75 ? "Healthy" : marketFeedHealth >= 60 ? "Degraded" : "Critical", detail: "Tick feed and symbol availability", updatedAt: new Date().toISOString() },
    { label: "Execution Channel Health", value: `${executionChannelHealth}/100`, status: executionChannelHealth >= 75 ? "Healthy" : executionChannelHealth >= 60 ? "Degraded" : "Critical", detail: "EA bridge + feedback channel", updatedAt: new Date().toISOString() },
    { label: "Infrastructure Risk Level", value: risk, status: risk === "Critical" ? "Critical" : risk === "High" ? "Degraded" : "Healthy", detail: state.disabledUnsafeTrading ? "Global trading disabled" : "Trading enabled", updatedAt: new Date().toISOString() }
  ];

  return { meta: { timestamp: new Date().toISOString(), currentRole: role, streamEndpoint: "/api/mt5/connection-health/events-stream" }, kpis, overallHealth: overall, infrastructureRiskLevel: risk };
}

export function listComponents(params: { search?: string; type?: string; status?: string; page?: number; pageSize?: number }): ComponentsResponse {
  const search = params.search?.trim().toLowerCase() ?? "";
  const type = params.type ?? "all";
  const status = params.status ?? "all";

  const filtered = state.components.filter((c) => {
    const matchesSearch =
      !search ||
      [c.componentId, c.componentType, c.componentName, c.broker ?? "", c.account ?? "", c.terminal ?? "", c.eaInstance ?? "", c.hostMachine, c.connectionStatus, c.riskLevel]
        .join(" ")
        .toLowerCase()
        .includes(search);
    const matchesType = type === "all" ? true : c.componentType === type;
    const matchesStatus = status === "all" ? true : c.connectionStatus === status || c.heartbeatStatus === status || c.riskLevel === status;
    return matchesSearch && matchesType && matchesStatus;
  });

  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 60;
  const start = (page - 1) * pageSize;
  return { meta: { timestamp: new Date().toISOString(), total: filtered.length, page, pageSize }, components: filtered.slice(start, start + pageSize) };
}

export function componentDetail(componentId: string): ComponentResponse {
  return { meta: { timestamp: new Date().toISOString() }, component: byId(componentId) };
}

export function workflow(): WorkflowResponse {
  recomputeWorkflowAndMap();
  return { meta: { timestamp: new Date().toISOString() }, workflow: state.workflow };
}

export function dependencyMap(): DependencyMapResponse {
  recomputeWorkflowAndMap();
  const derived = dependencyChainFailureDetection(
    state.dependencyMap.nodes.map((n) => ({ id: n.id, componentType: n.componentType, status: n.tone === "Healthy" ? "Healthy" : n.tone === "Degraded" ? "Degraded" : n.tone === "Critical" ? "Critical" : "Syncing" })),
    state.dependencyMap.edges
  );
  return { ...state.dependencyMap, ...derived, meta: { timestamp: new Date().toISOString() } };
}

export function latency(): LatencyResponse {
  return { meta: { timestamp: new Date().toISOString() }, points: state.latency };
}

export function packetLoss(): PacketLossResponse {
  return { meta: { timestamp: new Date().toISOString() }, points: state.packetLoss };
}

export function heartbeats(): HeartbeatsResponse {
  const rows = deriveHeartbeatRows(state.components).slice(0, 120);
  return { meta: { timestamp: new Date().toISOString(), total: rows.length }, heartbeats: rows };
}

export function incidents(filter?: string): IncidentsResponse {
  applyDerivedIncidents();
  const normalized = filter?.trim().toLowerCase() ?? "";
  const filtered = normalized
    ? state.incidents.filter((i) => [i.componentType, i.incidentType, i.severity, i.errorMessage, i.resolutionStatus].join(" ").toLowerCase().includes(normalized))
    : state.incidents;
  return { meta: { timestamp: new Date().toISOString(), total: filtered.length }, incidents: filtered };
}

export function logs(filter?: string): LogsResponse {
  const normalized = filter?.trim().toLowerCase() ?? "";
  const filtered = normalized ? state.logs.filter((l) => [l.componentType, l.eventType, l.severity, l.message].join(" ").toLowerCase().includes(normalized)) : state.logs;
  return { meta: { timestamp: new Date().toISOString(), total: filtered.length }, logs: filtered };
}

export function aiDiagnostics(): AiDiagnosticsResponse {
  const base = createMockDiagnostics().diagnostics;
  const derived = state.components
    .filter((c) => c.connectionStatus === "Offline" || c.connectionStatus === "Critical" || c.heartbeatStatus === "Offline" || c.packetLossPercent >= 3)
    .slice(0, 10)
    .map(
      (c): AiConnectionDiagnostic => ({
      id: `diag-${c.componentId}`,
      issue: c.connectionStatus === "Offline" ? "Disconnected component" : c.packetLossPercent >= 3 ? "Packet loss spike" : "Critical degradation",
      affectedComponentId: c.componentId,
      dependencyImpact: "Downstream trading path reliability decreases.",
      severity: c.connectionStatus === "Offline" || c.packetLossPercent >= 3 ? "Critical" : "Warning",
      rootCause: c.lastIncident ? "Recent incident detected." : "Realtime health drift.",
      tradingImpact: "Unsafe trading path risk elevated.",
      recommendedAction: c.connectionStatus === "Offline" ? "Reconnect and restart dependency chain." : "Run diagnostics and reconnect.",
      autoFixEligible: true,
      confidenceScore: Math.min(95, Math.max(55, c.healthScore))
      })
    );
  return { meta: { timestamp: new Date().toISOString() }, diagnostics: [...base, ...derived].slice(0, 18) };
}

export function componentDiagnostics(componentId: string, role: Mt5Role, request?: Request) {
  authorize(role, "diagnostics");
  const component = byId(componentId);
  addLog({
    timestamp: new Date().toISOString(),
    componentId,
    componentType: component.componentType,
    eventType: "Diagnostics",
    severity: component.connectionStatus === "Healthy" ? "Info" : "Warning",
    statusBefore: component.connectionStatus,
    statusAfter: component.connectionStatus,
    latencyMs: component.latencyMs,
    packetLossPercent: component.packetLossPercent,
    heartbeatDelaySeconds: component.heartbeatStatus === "Healthy" ? 0 : 45,
    message: "Component diagnostics executed.",
    rootCause: "Operator request",
    actionTaken: "Diagnostics",
    resolved: component.connectionStatus === "Healthy",
    resolvedAt: component.connectionStatus === "Healthy" ? new Date().toISOString() : null
  });
  audit(role, "Component diagnostics run", componentId, null, { status: component.connectionStatus }, request);
  return action(true, "Diagnostics completed.", [componentId]);
}

export function componentReconnect(componentId: string, role: Mt5Role, request?: Request) {
  authorize(role, "reconnect");
  const component = byId(componentId);
  const old = component.connectionStatus;
  const updated = updateComponent(componentId, { connectionStatus: old === "Offline" ? "Syncing" : component.connectionStatus, retryCount: component.retryCount + 1 });
  addLog({
    timestamp: new Date().toISOString(),
    componentId,
    componentType: component.componentType,
    eventType: "Reconnect",
    severity: old === "Offline" ? "Critical" : "Warning",
    statusBefore: old,
    statusAfter: updated.connectionStatus,
    latencyMs: updated.latencyMs,
    packetLossPercent: updated.packetLossPercent,
    heartbeatDelaySeconds: 0,
    message: "Reconnect initiated.",
    rootCause: "Dependency failure or manual operator action.",
    actionTaken: "Reconnect",
    resolved: false,
    resolvedAt: null
  });
  audit(role, "Component reconnect initiated", componentId, old, updated.connectionStatus, request);
  return action(true, "Reconnect initiated.", [componentId]);
}

export function componentRestart(componentId: string, role: Mt5Role, request?: Request) {
  authorize(role, "restart");
  const component = byId(componentId);
  const old = { connectionStatus: component.connectionStatus, latencyMs: component.latencyMs, packetLossPercent: component.packetLossPercent };
  const updated = updateComponent(componentId, { connectionStatus: "Syncing", latencyMs: Math.max(10, Math.round(component.latencyMs * 0.7)), packetLossPercent: Math.max(0, component.packetLossPercent * 0.6) });
  addLog({
    timestamp: new Date().toISOString(),
    componentId,
    componentType: component.componentType,
    eventType: "Restart",
    severity: "Warning",
    statusBefore: component.connectionStatus,
    statusAfter: updated.connectionStatus,
    latencyMs: updated.latencyMs,
    packetLossPercent: updated.packetLossPercent,
    heartbeatDelaySeconds: 0,
    message: "Restart initiated for unhealthy channel.",
    rootCause: "Latency/heartbeat degradation.",
    actionTaken: "Restart",
    resolved: false,
    resolvedAt: null
  });
  audit(role, "Component restart initiated", componentId, old, { status: updated.connectionStatus, latencyMs: updated.latencyMs, packetLossPercent: updated.packetLossPercent }, request);
  return action(true, "Restart initiated.", [componentId]);
}

export function disableTradingPath(componentId: string, role: Mt5Role, request?: Request) {
  authorize(role, "disablePath");
  const component = byId(componentId);
  const old = component.tradingPathActive;
  updateComponent(componentId, { tradingPathActive: false, riskLevel: "High" });
  addLog({
    timestamp: new Date().toISOString(),
    componentId,
    componentType: component.componentType,
    eventType: "Disable Trading Path",
    severity: "Critical",
    statusBefore: String(old),
    statusAfter: "false",
    latencyMs: component.latencyMs,
    packetLossPercent: component.packetLossPercent,
    heartbeatDelaySeconds: 0,
    message: "Trading path disabled for this component.",
    rootCause: "Unsafe dependency chain or operator decision.",
    actionTaken: "Disable path",
    resolved: true,
    resolvedAt: new Date().toISOString()
  });
  audit(role, "Trading path disabled", componentId, old, false, request);
  return action(true, "Trading path disabled.", [componentId]);
}

export function fullDiagnostics(role: Mt5Role, request?: Request) {
  authorize(role, "diagnostics");
  addLog({
    timestamp: new Date().toISOString(),
    componentId: "ALL",
    componentType: "ALL",
    eventType: "Full Diagnostics",
    severity: "Info",
    statusBefore: "—",
    statusAfter: "—",
    latencyMs: 0,
    packetLossPercent: 0,
    heartbeatDelaySeconds: 0,
    message: "Full diagnostics executed across connectivity chain.",
    rootCause: "Operator request",
    actionTaken: "Diagnostics",
    resolved: true,
    resolvedAt: new Date().toISOString()
  });
  audit(role, "Full diagnostics run", "connection-health", null, { components: state.components.length }, request);
  return action(true, "Full diagnostics completed.");
}

export function reconnectFailed(role: Mt5Role, request?: Request) {
  authorize(role, "reconnect");
  const failed = state.components.filter((c) => c.connectionStatus === "Offline" || c.connectionStatus === "Critical");
  const affected: string[] = [];
  for (const c of failed.slice(0, 25)) {
    updateComponent(c.componentId, { connectionStatus: "Syncing", retryCount: c.retryCount + 1 });
    affected.push(c.componentId);
  }
  addLog({
    timestamp: new Date().toISOString(),
    componentId: "ALL",
    componentType: "ALL",
    eventType: "Reconnect Failed",
    severity: affected.length ? "Warning" : "Info",
    statusBefore: "—",
    statusAfter: "—",
    latencyMs: 0,
    packetLossPercent: 0,
    heartbeatDelaySeconds: 0,
    message: `Reconnect attempted for ${affected.length} component(s).`,
    rootCause: "Auto recovery step",
    actionTaken: "Reconnect",
    resolved: false,
    resolvedAt: null
  });
  audit(role, "Reconnect failed services", "connection-health", null, { affected: affected.length }, request);
  return action(true, affected.length ? "Reconnect initiated for failed services." : "No failed services to reconnect.", affected);
}

export function restartUnhealthy(role: Mt5Role, request?: Request) {
  authorize(role, "restart");
  const unhealthy = state.components.filter((c) => c.connectionStatus === "Degraded" || c.connectionStatus === "Critical");
  const affected: string[] = [];
  for (const c of unhealthy.slice(0, 25)) {
    updateComponent(c.componentId, { connectionStatus: "Syncing", latencyMs: Math.max(10, Math.round(c.latencyMs * 0.75)) });
    affected.push(c.componentId);
  }
  addLog({
    timestamp: new Date().toISOString(),
    componentId: "ALL",
    componentType: "ALL",
    eventType: "Restart Unhealthy",
    severity: affected.length ? "Warning" : "Info",
    statusBefore: "—",
    statusAfter: "—",
    latencyMs: 0,
    packetLossPercent: 0,
    heartbeatDelaySeconds: 0,
    message: `Restart attempted for ${affected.length} component(s).`,
    rootCause: "Auto recovery step",
    actionTaken: "Restart",
    resolved: false,
    resolvedAt: null
  });
  audit(role, "Restart unhealthy channels", "connection-health", null, { affected: affected.length }, request);
  return action(true, affected.length ? "Restart initiated for unhealthy channels." : "No unhealthy channels to restart.", affected);
}

export function autoRemediate(role: Mt5Role, request?: Request) {
  authorize(role, "autoRemediate");
  recomputeWorkflowAndMap();
  const dep = dependencyMap();
  const affected: string[] = [];

  if (dep.firstFailedComponentId) {
    const target = dep.firstFailedComponentId;
    const component = state.components.find((c) => c.componentId === target);
    if (component) {
      if (component.connectionStatus === "Offline" || component.connectionStatus === "Critical") {
        updateComponent(target, { connectionStatus: "Syncing", retryCount: component.retryCount + 1 });
      } else {
        updateComponent(target, { connectionStatus: "Syncing" });
      }
      affected.push(target);
    }
  }

  addLog({
    timestamp: new Date().toISOString(),
    componentId: "ALL",
    componentType: "ALL",
    eventType: "Auto-Remediate",
    severity: affected.length ? "Warning" : "Info",
    statusBefore: "—",
    statusAfter: "—",
    latencyMs: 0,
    packetLossPercent: 0,
    heartbeatDelaySeconds: 0,
    message: affected.length ? "Auto-remediation applied to first failed dependency." : "No remediation required.",
    rootCause: "AI remediation workflow",
    actionTaken: "Remediate",
    resolved: false,
    resolvedAt: null
  });
  audit(role, "Auto-remediation executed", "connection-health", null, { affected }, request);
  return action(true, affected.length ? "Auto-remediation applied." : "No remediation required.", affected);
}

export function disableUnsafeTrading(role: Mt5Role, request?: Request) {
  authorize(role, "disableUnsafeTrading");
  const old = state.disabledUnsafeTrading;
  state.disabledUnsafeTrading = true;
  addLog({
    timestamp: new Date().toISOString(),
    componentId: "ALL",
    componentType: "ALL",
    eventType: "Disable Unsafe Trading",
    severity: "Critical",
    statusBefore: String(old),
    statusAfter: "true",
    latencyMs: 0,
    packetLossPercent: 0,
    heartbeatDelaySeconds: 0,
    message: "Global unsafe trading disable activated.",
    rootCause: "Operator emergency safety action.",
    actionTaken: "Disable trading",
    resolved: true,
    resolvedAt: new Date().toISOString()
  });
  audit(role, "Disable unsafe trading globally", "connection-health", old, true, request);
  return action(true, "Unsafe trading disabled globally.");
}

export function isTradingSafe() {
  const mapByType: Partial<Record<any, ConnectionComponent>> = {};
  for (const c of state.components) {
    if (!mapByType[c.componentType]) mapByType[c.componentType] = c;
  }
  const safe = tradingPathSafety(mapByType as any, !state.disabledUnsafeTrading);
  return safe;
}

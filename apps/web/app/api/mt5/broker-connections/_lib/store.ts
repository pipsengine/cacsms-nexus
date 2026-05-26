import type { AuditRecord, Mt5Role } from "@/modules/mt5-infrastructure-and-broker-connectivity/mt5-control-center/types/mt5-control-center.types";
import {
  calculateBrokerHealth,
  detectExecutionDegradation,
  detectSpreadSpikes,
  rankBrokerReliability,
  recommendBrokerRecovery
} from "@/modules/mt5-infrastructure-and-broker-connectivity/broker-connections/algorithms/broker-connections.algorithms";
import { createBrokerConnectionsSeed } from "@/modules/mt5-infrastructure-and-broker-connectivity/broker-connections/data/broker-connections.mock";
import type {
  BrokerConnection,
  BrokerConnectionTest,
  BrokerConnectionsResponse,
  BrokerDiagnostic,
  BrokerIncident,
  BrokerSeverity
} from "@/modules/mt5-infrastructure-and-broker-connectivity/broker-connections/types/broker-connections.types";
import { resolveMt5Role } from "../../_lib/access";
import { bindPersistedMt5State } from "../../_lib/persistence";

const seed = createBrokerConnectionsSeed();
const state = bindPersistedMt5State("broker-connections", () => ({
  ...seed,
  audits: [] as AuditRecord[],
  lastSyncAt: new Date().toISOString(),
  restorationApprovals: new Set<string>()
}));
export function brokerRole(request?: Request): Mt5Role {
  return resolveMt5Role(request);
}

const permissions: Record<string, Mt5Role[]> = {
  sync: ["Super Admin", "Infrastructure Admin"],
  test: ["Super Admin", "Infrastructure Admin"],
  reconnect: ["Super Admin", "Infrastructure Admin"],
  diagnostics: ["Super Admin", "Infrastructure Admin"],
  executionControl: ["Super Admin", "Trading Admin"],
  approveRestoration: ["Super Admin", "Risk Manager"],
  autoRemediate: ["Super Admin", "Infrastructure Admin"],
  delete: ["Super Admin"]
};

function authorize(role: Mt5Role, action: keyof typeof permissions) {
  if (!permissions[action].includes(role)) throw new Error(`Role "${role}" is not authorized to perform broker ${action}.`);
}

function requireConfirmation(confirmed?: boolean) {
  if (!confirmed) throw new Error("Confirmation is required for this restricted broker action.");
}

function audit(role: Mt5Role, action: string, entityId: string, oldValue: unknown, newValue: unknown, request?: Request) {
  state.audits.unshift({
    id: `broker-audit-${Date.now()}-${state.audits.length}`,
    userId: request?.headers.get("x-user-id") ?? role.toLowerCase().replace(/\s+/g, "-"),
    action,
    module: "Broker Connections",
    entityId,
    oldValue,
    newValue,
    ipAddress: request?.headers.get("x-forwarded-for") ?? "system",
    userAgent: request?.headers.get("user-agent") ?? "autonomous-broker-monitor",
    timestamp: new Date().toISOString()
  });
}

function brokerById(id: string) {
  const broker = state.brokers.find((item) => item.id === id);
  if (!broker) throw new Error("Broker connection not found.");
  return broker;
}

function addIncident(broker: BrokerConnection, incidentType: BrokerIncident["incidentType"], severity: BrokerSeverity, message: string, rootCause: string, actionTaken: string) {
  state.incidents.unshift({
    id: `incident-${Date.now()}-${state.incidents.length}`,
    brokerId: broker.id,
    brokerName: broker.brokerName,
    serverName: broker.mt5ServerName,
    accountLogin: "Infrastructure session",
    incidentType,
    severity,
    errorCode: severity === "Critical" ? "BRK-CRITICAL" : "BRK-MONITOR",
    errorMessage: message,
    rootCause,
    actionTaken,
    autoResolved: false,
    resolutionStatus: severity === "Critical" ? "Open" : "Monitoring",
    createdAt: new Date().toISOString()
  });
}

function refreshBroker(broker: BrokerConnection) {
  const health = calculateBrokerHealth(broker, state.incidents);
  broker.healthScore = health.score;
  broker.riskLevel = health.score < 40 ? "Critical" : health.score < 60 ? "Degraded" : health.score < 75 ? "Watch" : "Healthy";
  return broker;
}

export function brokerConnections() { return state.brokers.map(refreshBroker); }
export function brokerConnection(id: string) { return refreshBroker(brokerById(id)); }
export function brokerConnectionTests() { return state.tests; }
export function brokerIncidents(id?: string) { return id ? state.incidents.filter((item) => item.brokerId === id) : state.incidents; }
export function brokerLatency() { return state.latencyLogs; }
export function brokerSpreads() { return state.spreadLogs; }
export function brokerExecutionQuality() { return state.executionQuality; }
export function brokerDiagnostics() { return state.diagnostics; }
export function brokerAudits() { return state.audits; }

export function syncBrokerConnections(role: Mt5Role, confirmed: boolean, request?: Request) {
  authorize(role, "sync");
  requireConfirmation(confirmed);
  state.lastSyncAt = new Date().toISOString();
  audit(role, "Broker connections synchronized", "all-brokers", null, { count: state.brokers.length, at: state.lastSyncAt }, request);
  return brokerConnections();
}

export function testBrokerConnection(id: string, role: Mt5Role, confirmed: boolean, request?: Request) {
  authorize(role, "test");
  requireConfirmation(confirmed);
  const broker = brokerConnection(id);
  const passed = broker.serverReachable && broker.loginStatus !== "Critical";
  const test: BrokerConnectionTest = {
    id: `test-${Date.now()}-${state.tests.length}`, brokerId: id, testType: "Full Connectivity", testStatus: passed ? "Healthy" : "Critical",
    latencyMs: broker.averageLatencyMs, loginSuccess: passed, dataFeedSuccess: broker.dataFeedActive, executionGatewaySuccess: broker.executionStatus === "Healthy",
    symbolSyncSuccess: broker.dataFeedActive, accountSyncSuccess: passed, failureReason: passed ? null : broker.lastErrorMessage ?? "Connection validation failed.",
    testedBy: role, createdAt: new Date().toISOString()
  };
  state.tests.unshift(test);
  if (!passed) addIncident(broker, "Server Timeout", "Critical", "Broker connection test failed.", test.failureReason ?? "Unknown test failure.", "Execution remains quarantined pending recovery.");
  audit(role, "Broker connection tested", id, null, test, request);
  return test;
}

export function reconnectBroker(id: string, role: Mt5Role, confirmed: boolean, request?: Request) {
  authorize(role, "reconnect");
  requireConfirmation(confirmed);
  const broker = brokerConnection(id);
  const old = { connectionStatus: broker.connectionStatus, executionStatus: broker.executionStatus };
  broker.connectionStatus = "Syncing";
  broker.executionStatus = broker.executionEnabled ? "Syncing" : "Critical";
  broker.updatedAt = new Date().toISOString();
  addIncident(broker, "Recovery", "Warning", "Controlled broker reconnect initiated.", "Automated recovery requested after health validation.", "Reachability, login, symbol, and account validation queued.");
  audit(role, "Broker reconnect initiated", id, old, { connectionStatus: broker.connectionStatus }, request);
  return { broker, workflow: recommendBrokerRecovery(broker) };
}

export function syncBrokerSymbols(id: string, role: Mt5Role, confirmed: boolean, request?: Request) {
  authorize(role, "sync");
  requireConfirmation(confirmed);
  const broker = brokerConnection(id);
  const old = broker.candleSyncStatus;
  broker.candleSyncStatus = broker.dataFeedActive ? "Healthy" : "Critical";
  audit(role, "Broker symbols synchronized", id, old, broker.candleSyncStatus, request);
  return broker;
}

export function syncBrokerAccounts(id: string, role: Mt5Role, confirmed: boolean, request?: Request) {
  authorize(role, "sync");
  requireConfirmation(confirmed);
  const broker = brokerConnection(id);
  audit(role, "Broker accounts synchronized", id, null, { loginStatus: broker.loginStatus }, request);
  return broker;
}

export function setBrokerExecution(id: string, enabled: boolean, role: Mt5Role, confirmed: boolean, riskApproved = false, request?: Request) {
  authorize(role, "executionControl");
  requireConfirmation(confirmed);
  const broker = brokerConnection(id);
  const approved = state.restorationApprovals.has(id) || (riskApproved && role === "Super Admin");
  if (enabled && (broker.riskLevel === "Critical" || broker.connectionStatus === "Offline") && !approved) {
    throw new Error("Execution restoration blocked: critical broker recovery requires Risk Manager approval.");
  }
  const old = { enabled: broker.executionEnabled, status: broker.executionStatus };
  broker.executionEnabled = enabled;
  broker.executionStatus = enabled ? "Healthy" : "Critical";
  addIncident(broker, enabled ? "Recovery" : "Trade Rejection", enabled ? "Info" : "Critical", `Broker execution ${enabled ? "enabled" : "disabled"}.`, enabled ? "Approved restoration completed." : "Operator safety control invoked.", enabled ? "Routing restored." : "Order routing blocked.");
  audit(role, enabled ? "Broker execution enabled" : "Broker execution disabled", id, old, { enabled, status: broker.executionStatus }, request);
  if (enabled) state.restorationApprovals.delete(id);
  return broker;
}

export function approveBrokerRestoration(id: string, role: Mt5Role, confirmed: boolean, request?: Request) {
  authorize(role, "approveRestoration");
  requireConfirmation(confirmed);
  const broker = brokerConnection(id);
  state.restorationApprovals.add(id);
  audit(role, "High-risk broker restoration approved", id, { approved: false }, { approved: true, riskLevel: broker.riskLevel }, request);
  return { brokerId: id, approved: true, approvedBy: role, expiresAfterRestoration: true };
}

export function runBrokerDiagnostics(id: string | null, role: Mt5Role, confirmed: boolean, request?: Request) {
  authorize(role, "diagnostics");
  requireConfirmation(confirmed);
  const diagnostics = id ? state.diagnostics.filter((item) => item.brokerId === id) : state.diagnostics;
  const broker = id ? brokerConnection(id) : null;
  const analytics = broker ? { spread: detectSpreadSpikes(state.spreadLogs, broker.id), execution: detectExecutionDegradation(state.executionQuality, broker.id) } : null;
  audit(role, "Broker diagnostics run", id ?? "all-brokers", null, { issues: diagnostics.length }, request);
  return { completedAt: new Date().toISOString(), diagnostics, analytics };
}

export function autoRemediateBroker(diagnosticId: string, role: Mt5Role, confirmed: boolean, request?: Request) {
  authorize(role, "autoRemediate");
  requireConfirmation(confirmed);
  const diagnostic = state.diagnostics.find((item) => item.id === diagnosticId);
  if (!diagnostic) throw new Error("Broker diagnostic not found.");
  if (!diagnostic.autoRemediationAvailable) throw new Error("This broker issue is not eligible for auto-remediation.");
  const broker = brokerConnection(diagnostic.brokerId);
  if (diagnostic.severity === "Critical") {
    broker.executionEnabled = false;
    broker.executionStatus = "Critical";
  }
  broker.connectionStatus = "Syncing";
  diagnostic.autoRemediationStatus = "Running";
  addIncident(broker, "Recovery", "Warning", "AI-assisted broker recovery initiated.", diagnostic.rootCause, "Execution safety enforced; controlled reconnect and synchronization queued.");
  audit(role, "Broker auto-remediation triggered", diagnosticId, "Available", { status: diagnostic.autoRemediationStatus, brokerId: broker.id }, request);
  return { diagnostic, broker, workflow: recommendBrokerRecovery(broker) };
}

export function buildBrokerConnectionsResponse(role: Mt5Role = "Infrastructure Admin"): BrokerConnectionsResponse {
  const brokers = brokerConnections();
  const now = new Date().toISOString();
  const rankings = rankBrokerReliability(brokers);
  const averageLatency = Math.round(brokers.reduce((sum, broker) => sum + broker.averageLatencyMs, 0) / brokers.length);
  const averageSpread = Math.round(brokers.reduce((sum, broker) => sum + broker.spreadStabilityScore, 0) / brokers.length);
  const rejectionRate = (brokers.reduce((sum, broker) => sum + broker.rejectionRate, 0) / brokers.length).toFixed(1);
  const titles = ["Broker Registered", "Server Reachable", "Account Login Validated", "Symbols Available", "Market Data Active", "Trading Permission Verified", "Execution Gateway Ready", "Feedback Received", "Audit Logged"];
  return {
    meta: { timestamp: now, currentRole: role, streamEndpoint: "/api/mt5/broker-connections/events-stream", monitoringMode: "Autonomous Broker Monitoring" },
    kpis: [
      { label: "Total Brokers", value: String(brokers.length), status: "Healthy", detail: "Registered MT5 providers", updatedAt: now },
      { label: "Connected Brokers", value: String(brokers.filter((broker) => broker.connectionStatus === "Healthy").length), status: "Healthy", detail: "Sessions available", updatedAt: now },
      { label: "Disconnected Brokers", value: String(brokers.filter((broker) => broker.connectionStatus === "Offline").length), status: "Critical", detail: "Unreachable endpoints", updatedAt: now },
      { label: "Degraded Brokers", value: String(brokers.filter((broker) => broker.connectionStatus === "Degraded").length), status: "Degraded", detail: "Require monitoring", updatedAt: now },
      { label: "Execution-Ready Brokers", value: String(brokers.filter((broker) => broker.executionEnabled && broker.executionStatus === "Healthy").length), status: "Healthy", detail: "Approved routing", updatedAt: now },
      { label: "Data Feed Active", value: `${brokers.filter((broker) => broker.dataFeedActive).length}/${brokers.length}`, status: "Degraded", detail: "Receiving live quotes", updatedAt: now },
      { label: "Average Broker Latency", value: `${averageLatency} ms`, status: averageLatency > 150 ? "Degraded" : "Healthy", detail: "Server round trip", updatedAt: now },
      { label: "Average Spread Stability", value: `${averageSpread}%`, status: averageSpread > 75 ? "Healthy" : "Degraded", detail: "Normalized spread quality", updatedAt: now },
      { label: "Failed Login Attempts", value: String(brokers.reduce((sum, broker) => sum + broker.failedLoginCount, 0)), status: "Critical", detail: "Current observation period", updatedAt: now },
      { label: "Trade Rejection Rate", value: `${rejectionRate}%`, status: Number(rejectionRate) > 5 ? "Critical" : "Healthy", detail: "Broker execution rejects", updatedAt: now },
      { label: "Best Execution Broker", value: rankings.bestExecutionBroker, status: "Healthy", detail: "Weighted fill quality", updatedAt: now },
      { label: "Highest Risk Broker", value: rankings.highestRiskBroker, status: "Critical", detail: "Execution restricted", updatedAt: now }
    ],
    workflow: titles.map((title, index) => ({
      title,
      status: index >= 1 && brokers.some((broker) => broker.connectionStatus === "Offline") ? index >= 5 ? "Critical" : "Degraded" : "Healthy",
      count: index === 1 ? brokers.filter((broker) => broker.serverReachable).length : brokers.filter((broker) => index < 4 ? broker.loginStatus !== "Critical" : broker.dataFeedActive).length,
      failureCount: index < 2 ? brokers.filter((broker) => !broker.serverReachable).length : brokers.filter((broker) => broker.riskLevel === "Critical").length,
      averageDelayMs: averageLatency,
      lastCheckedAt: now,
      aiRecommendation: index === 6 ? "Remove FTMO from routing until gateway validation passes." : undefined
    })),
    brokers,
    connectionTests: state.tests,
    rankings,
    latencyLogs: state.latencyLogs,
    spreadLogs: state.spreadLogs,
    executionQuality: state.executionQuality,
    incidents: state.incidents,
    diagnostics: state.diagnostics,
    audits: state.audits,
    permissions: {
      role,
      canSync: permissions.sync.includes(role),
      canTest: permissions.test.includes(role),
      canReconnect: permissions.reconnect.includes(role),
      canDiagnostics: permissions.diagnostics.includes(role),
      canExecutionControl: permissions.executionControl.includes(role),
      canApproveRestoration: permissions.approveRestoration.includes(role),
      canAutoRemediate: permissions.autoRemediate.includes(role),
      canDelete: permissions.delete.includes(role)
    }
  };
}

export function brokerSummary(role: Mt5Role) {
  const response = buildBrokerConnectionsResponse(role);
  return { meta: response.meta, kpis: response.kpis, workflow: response.workflow, rankings: response.rankings, permissions: response.permissions };
}

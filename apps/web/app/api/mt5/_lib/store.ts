import { createMt5Seed } from "@/modules/mt5-infrastructure-and-broker-connectivity/mt5-control-center/data/mt5-control-center.mock";
import {
  analyzeSymbolMappings,
  calculateConnectionHealthScore,
  calculateExecutionQuality,
  detectMarketDataGaps,
  normalizeSymbol,
  rankBrokers,
  recommendRecovery
} from "@/modules/mt5-infrastructure-and-broker-connectivity/mt5-control-center/algorithms/mt5-control-center.algorithms";
import type {
  Account,
  AuditRecord,
  Broker,
  Mt5ControlCenterResponse,
  Mt5Role,
  SymbolMapping,
  Terminal
} from "@/modules/mt5-infrastructure-and-broker-connectivity/mt5-control-center/types/mt5-control-center.types";
import { resolveMt5Role } from "./access";
import { bindPersistedMt5State } from "./persistence";

const state = bindPersistedMt5State("mt5-control-center", () => ({
  ...createMt5Seed(),
  audit: [] as AuditRecord[]
}));

export function getRole(request?: Request): Mt5Role {
  return resolveMt5Role(request);
}

const actionRoles: Record<string, Mt5Role[]> = {
  "terminal.register": ["Super Admin", "Infrastructure Admin"],
  "terminal.update": ["Super Admin", "Infrastructure Admin"],
  "terminal.restart": ["Super Admin", "Infrastructure Admin"],
  "terminal.disable": ["Super Admin", "Infrastructure Admin"],
  "terminal.delete": ["Super Admin"],
  "broker.sync": ["Super Admin", "Infrastructure Admin"],
  "broker.test": ["Super Admin", "Infrastructure Admin"],
  "broker.configure": ["Super Admin"],
  "account.sync": ["Super Admin", "Infrastructure Admin", "Trading Admin"],
  "account.permission": ["Super Admin", "Trading Admin"],
  "symbol.sync": ["Super Admin", "Infrastructure Admin"],
  "symbol.mapping": ["Super Admin", "Infrastructure Admin"],
  "diagnostic.run": ["Super Admin", "Infrastructure Admin"],
  "diagnostic.remediate": ["Super Admin", "Infrastructure Admin"],
  "trading.emergency-disable": ["Super Admin"]
};

export function authorize(role: Mt5Role, action: string) {
  if (!(actionRoles[action] ?? []).includes(role)) {
    throw new Error(`Role "${role}" is not authorized to perform ${action}.`);
  }
}

function audit(role: Mt5Role, action: string, entityId: string, oldValue: unknown, newValue: unknown, request?: Request) {
  state.audit.unshift({
    id: `audit-${Date.now()}-${state.audit.length + 1}`,
    userId: request?.headers.get("x-user-id") ?? role.toLowerCase().replace(/\s+/g, "-"),
    action,
    module: "MT5 Control Center",
    entityId,
    oldValue,
    newValue,
    ipAddress: request?.headers.get("x-forwarded-for") ?? "system",
    userAgent: request?.headers.get("user-agent") ?? "autonomous-monitor",
    timestamp: new Date().toISOString()
  });
}

export function getAuditRecords() {
  return state.audit;
}

export function getTerminals() {
  return state.terminals;
}

export function getTerminal(id: string) {
  return state.terminals.find((terminal) => terminal.id === id);
}

export function registerTerminal(input: Partial<Terminal>, role: Mt5Role, request?: Request) {
  authorize(role, "terminal.register");
  if (!input.terminalUuid || state.terminals.some((terminal) => terminal.terminalUuid === input.terminalUuid)) {
    throw new Error("Duplicate terminal registration or missing terminal UUID.");
  }
  const terminal: Terminal = {
    id: `term-${Date.now()}`, terminalUuid: input.terminalUuid, terminalName: input.terminalName ?? "New MT5 Terminal",
    brokerId: input.brokerId ?? "unassigned", brokerName: input.brokerName ?? "Unassigned", serverName: input.serverName ?? "Unknown",
    accountLogin: input.accountLogin ?? "-", accountType: input.accountType ?? "Demo", terminalVersion: input.terminalVersion ?? "Unknown",
    hostMachine: input.hostMachine ?? "Unassigned", status: "Syncing", cpuUsage: 0, memoryUsage: 0, diskUsage: 0, latencyMs: 0,
    uptimeSeconds: 0, lastHeartbeatAt: new Date().toISOString(), autoRestartEnabled: true, tradingEnabled: false
  };
  state.terminals.push(terminal);
  audit(role, "Terminal registered", terminal.id, null, terminal, request);
  return terminal;
}

export function bindRegisteredTerminalAccount(input: {
  terminal: Terminal;
  accountId: string;
  accountLogin: string;
  accountType: string;
  currency: string;
  leverage: string;
}, role: Mt5Role, request?: Request) {
  authorize(role, "terminal.register");
  if (state.accounts.some((account) => account.terminalId === input.terminal.id || account.accountLogin === input.accountLogin)) {
    throw new Error("Duplicate terminal account binding.");
  }
  const account: Account = {
    id: input.accountId,
    brokerId: input.terminal.brokerId,
    brokerName: input.terminal.brokerName,
    terminalId: input.terminal.id,
    accountLogin: input.accountLogin,
    accountType: input.accountType,
    currency: input.currency,
    balance: 0,
    equity: 0,
    margin: 0,
    freeMargin: 0,
    leverage: input.leverage,
    tradeAllowed: false,
    syncStatus: "Syncing",
    lastSyncAt: new Date().toISOString(),
    status: "Syncing"
  };
  state.accounts.push(account);
  audit(role, "Terminal account binding provisioned", account.id, null, { terminalId: input.terminal.id, accountLogin: account.accountLogin, tradingEnabled: false }, request);
  return account;
}

export function activateRegisteredTerminalFromHeartbeat(terminalId: string, input: {
  terminalName: string;
  brokerConnected: boolean;
  latencyMs: number;
}, receivedAt: string) {
  const terminal = getTerminal(terminalId);
  if (!terminal) throw new Error("Registered MT5 terminal not found for verified heartbeat.");
  terminal.terminalName = input.terminalName || terminal.terminalName;
  terminal.status = input.brokerConnected ? "Healthy" : "Warning";
  terminal.latencyMs = input.latencyMs;
  terminal.lastHeartbeatAt = receivedAt;
  return terminal;
}

export function updateTerminal(id: string, input: Partial<Terminal>, role: Mt5Role, request?: Request) {
  authorize(role, "terminal.update");
  const terminal = getTerminal(id);
  if (!terminal) throw new Error("MT5 terminal not found.");
  const old = { ...terminal };
  Object.assign(terminal, input, { id: terminal.id });
  audit(role, "Terminal updated", id, old, terminal, request);
  return terminal;
}

export function restartTerminal(id: string, role: Mt5Role, request?: Request) {
  authorize(role, "terminal.restart");
  const terminal = getTerminal(id);
  if (!terminal) throw new Error("MT5 terminal not found.");
  const old = { ...terminal };
  terminal.status = "Syncing";
  terminal.lastHeartbeatAt = new Date().toISOString();
  terminal.uptimeSeconds = 0;
  state.incidents.unshift({
    id: `event-${Date.now()}`, terminalId: id, brokerId: terminal.brokerId, eventType: "Terminal restart", severity: "Warning",
    statusBefore: old.status, statusAfter: "Syncing", message: `Restart workflow initiated for ${terminal.terminalName}.`,
    rootCause: "Operator or autonomous recovery action", autoResolved: false, createdAt: new Date().toISOString()
  });
  audit(role, "Terminal restart", id, old.status, terminal.status, request);
  return { terminal, recoveryWorkflow: recommendRecovery(old) };
}

export function disableTerminal(id: string, role: Mt5Role, request?: Request) {
  authorize(role, "terminal.disable");
  const terminal = getTerminal(id);
  if (!terminal) throw new Error("MT5 terminal not found.");
  const old = { tradingEnabled: terminal.tradingEnabled, status: terminal.status };
  terminal.tradingEnabled = false;
  terminal.status = "Inactive";
  audit(role, "Terminal trading disabled", id, old, { tradingEnabled: false, status: terminal.status }, request);
  return terminal;
}

export function deleteTerminal(id: string, role: Mt5Role, request?: Request) {
  authorize(role, "terminal.delete");
  const index = state.terminals.findIndex((terminal) => terminal.id === id);
  if (index < 0) throw new Error("MT5 terminal not found.");
  const [removed] = state.terminals.splice(index, 1);
  audit(role, "Terminal deleted", id, removed, null, request);
  return removed;
}

export function getBrokers() { return state.brokers; }
export function getBroker(id: string) { return state.brokers.find((broker) => broker.id === id); }

export function syncBrokers(role: Mt5Role, request?: Request) {
  authorize(role, "broker.sync");
  state.brokers.forEach((broker) => {
    if (broker.status !== "Critical") broker.status = broker.averageLatencyMs > 200 ? "Warning" : "Healthy";
  });
  audit(role, "Broker synchronization", "all", null, { synchronized: state.brokers.length }, request);
  return state.brokers;
}

export function testBroker(id: string, role: Mt5Role, request?: Request) {
  authorize(role, "broker.test");
  const broker = getBroker(id);
  if (!broker) throw new Error("Broker not found.");
  audit(role, "Broker connection tested", id, null, { status: broker.status, latencyMs: broker.averageLatencyMs }, request);
  return { brokerId: id, status: broker.status, latencyMs: broker.averageLatencyMs, checkedAt: new Date().toISOString() };
}

export function configureBroker(id: string, input: Partial<Broker>, role: Mt5Role, request?: Request) {
  authorize(role, "broker.configure");
  const broker = getBroker(id);
  if (!broker) throw new Error("Broker not found.");
  const old = { ...broker };
  Object.assign(broker, input, { id: broker.id });
  audit(role, "Broker configuration updated", id, old, broker, request);
  return broker;
}

export function getAccounts() { return state.accounts; }
export function getAccount(id: string) { return state.accounts.find((account) => account.id === id); }

export function syncAccount(id: string, role: Mt5Role, request?: Request) {
  authorize(role, "account.sync");
  const account = getAccount(id);
  if (!account) throw new Error("Account not found.");
  const old = account.lastSyncAt;
  account.lastSyncAt = new Date().toISOString();
  account.syncStatus = account.status === "Critical" ? "Critical" : "Healthy";
  audit(role, "Account synchronized", id, old, account.lastSyncAt, request);
  return account;
}

export function syncAllAccounts(role: Mt5Role, request?: Request) {
  state.accounts.forEach((account) => syncAccount(account.id, role, request));
  return state.accounts;
}

export function setTradingPermission(id: string, tradeAllowed: boolean, role: Mt5Role, request?: Request) {
  authorize(role, "account.permission");
  const account = getAccount(id);
  if (!account) throw new Error("Account not found.");
  const old = account.tradeAllowed;
  account.tradeAllowed = tradeAllowed;
  audit(role, tradeAllowed ? "Trading enabled" : "Trading disabled", id, old, tradeAllowed, request);
  return account;
}

export function emergencyDisableTrading(role: Mt5Role, request?: Request) {
  authorize(role, "trading.emergency-disable");
  state.accounts.forEach((account) => { account.tradeAllowed = false; });
  state.terminals.forEach((terminal) => { terminal.tradingEnabled = false; });
  audit(role, "Emergency shutdown", "all-trading", { enabled: true }, { enabled: false }, request);
  return { status: "Critical", message: "All trading routes disabled.", accountsAffected: state.accounts.length };
}

export function getSymbols() { return state.symbols; }

export function syncSymbols(role: Mt5Role, request?: Request) {
  authorize(role, "symbol.sync");
  state.symbols.forEach((symbol) => {
    const normalized = normalizeSymbol(symbol.brokerSymbol);
    symbol.normalizedSymbol = normalized.normalizedSymbol;
    symbol.assetClass = normalized.assetClass;
    symbol.mappingStatus = normalized.known && symbol.dataFeedActive ? "Healthy" : "Critical";
  });
  audit(role, "Symbol synchronization", "all", null, analyzeSymbolMappings(state.symbols), request);
  return state.symbols;
}

export function updateSymbolMapping(id: string, input: Partial<SymbolMapping>, role: Mt5Role, request?: Request) {
  authorize(role, "symbol.mapping");
  const symbol = state.symbols.find((item) => item.id === id);
  if (!symbol) throw new Error("Symbol mapping not found.");
  const old = { ...symbol };
  Object.assign(symbol, input, { id: symbol.id });
  audit(role, "Symbol remapped", id, old, symbol, request);
  return symbol;
}

export function runDiagnostics(role: Mt5Role, request?: Request) {
  authorize(role, "diagnostic.run");
  audit(role, "Diagnostics run", "infrastructure", null, { issues: state.diagnostics.length }, request);
  return { completedAt: new Date().toISOString(), diagnostics: state.diagnostics };
}

export function autoRemediate(diagnosticId: string, role: Mt5Role, request?: Request) {
  authorize(role, "diagnostic.remediate");
  const diagnostic = state.diagnostics.find((item) => item.id === diagnosticId);
  if (!diagnostic) throw new Error("Diagnostic recommendation not found.");
  if (!diagnostic.autoRemediationAvailable) throw new Error("Auto-remediation is unavailable for this issue.");
  diagnostic.autoRemediationStatus = "Running";
  audit(role, "Auto-remediation triggered", diagnosticId, "Available", "Running", request);
  return { diagnostic, workflow: ["Attempt reconnect", "Restart terminal if required", "Re-authenticate", "Re-sync symbols", "Validate trading permissions"] };
}

export function buildControlCenter(role: Mt5Role = "Infrastructure Admin"): Mt5ControlCenterResponse {
  const critical = state.incidents.filter((incident) => incident.severity === "Critical" && !incident.autoResolved).length;
  const heartbeat = Math.max(...state.terminals.map((terminal) => (Date.now() - new Date(terminal.lastHeartbeatAt).getTime()) / 1000));
  const execution = calculateExecutionQuality(state.executionSamples);
  const gaps = detectMarketDataGaps(state.symbols);
  const connectionHealth = calculateConnectionHealthScore({
    uptimePercent: state.brokers.reduce((sum, broker) => sum + broker.uptimePercent, 0) / state.brokers.length,
    heartbeatAgeSeconds: heartbeat,
    latencyMs: state.brokers.reduce((sum, broker) => sum + broker.averageLatencyMs, 0) / state.brokers.length,
    dataFeedQuality: state.brokers.reduce((sum, broker) => sum + broker.dataFeedQualityScore, 0) / state.brokers.length,
    loginSuccessPercent: 100 - (state.brokers.filter((broker) => broker.loginHealth === "Critical").length / state.brokers.length) * 100,
    executionSuccessPercent: 100 - execution.rejectionRate,
    criticalIncidents: critical
  });
  const brokerMetrics = state.brokers.map((broker) => {
    const samples = state.executionSamples.filter((sample) => sample.brokerId === broker.id);
    const metric = calculateExecutionQuality(samples);
    return { brokerId: broker.id, brokerName: broker.brokerName, latencyMs: broker.averageLatencyMs, executionMs: metric.averageExecutionMs, slippage: metric.averageSlippagePoints, rejected: metric.rejectionRate };
  });
  return {
    meta: { timestamp: new Date().toISOString(), streamEndpoint: "/api/mt5/events", currentRole: role, monitoringMode: "Autonomous" },
    kpis: [
      { label: "Active MT5 Terminals", value: `${state.terminals.filter((terminal) => terminal.status !== "Offline").length}/${state.terminals.length}`, status: state.terminals.some((terminal) => terminal.status === "Critical") ? "Warning" : "Healthy", detail: "Heartbeat monitored" },
      { label: "Connected Brokers", value: `${state.brokers.filter((broker) => broker.status !== "Critical").length}/${state.brokers.length}`, status: "Warning", detail: "One login failure" },
      { label: "Live Trading Accounts", value: String(state.accounts.filter((account) => account.tradeAllowed).length), status: "Healthy", detail: "Permission enforced" },
      { label: "Market Data Status", value: gaps.missingTicks.length ? "Degraded" : "Live", status: gaps.missingTicks.length ? "Warning" : "Healthy", detail: `${gaps.delayedTicks.length} delayed feed(s)` },
      { label: "Execution Gateway", value: execution.fillQualityScore > 70 ? "Active" : "At Risk", status: execution.fillQualityScore > 70 ? "Healthy" : "Warning", detail: `${execution.fillQualityScore}/100 quality` },
      { label: "Average Latency", value: `${Math.round(state.brokers.reduce((sum, broker) => sum + broker.averageLatencyMs, 0) / state.brokers.length)} ms`, status: "Warning", detail: "FTMO path elevated" },
      { label: "Failed Login Sessions", value: "1", status: "Critical", detail: "FTMO authentication" },
      { label: "Trade Rejection Rate", value: `${execution.rejectionRate}%`, status: execution.rejectionRate > 10 ? "Critical" : "Healthy", detail: "Rolling executions" },
      { label: "Last Successful Sync", value: new Date(Math.max(...state.accounts.map((account) => new Date(account.lastSyncAt).getTime()))).toLocaleTimeString(), status: "Healthy", detail: "Account snapshots" },
      { label: "Infrastructure Risk", value: connectionHealth.rating, status: connectionHealth.score >= 75 ? "Healthy" : connectionHealth.score >= 60 ? "Warning" : "Critical", detail: `${connectionHealth.score}/100` }
    ],
    connectionHealth,
    workflow: state.workflow,
    terminals: state.terminals,
    brokers: state.brokers,
    accounts: state.accounts,
    symbols: state.symbols,
    executionQuality: { ...execution, delayedTicks: gaps.delayedTicks.length, marketDataGaps: gaps.missingTicks.length, brokerMetrics },
    brokerRanking: rankBrokers(state.brokers),
    diagnostics: state.diagnostics,
    incidents: state.incidents,
    permissions: {
      role,
      canRegisterTerminal: ["Super Admin", "Infrastructure Admin"].includes(role),
      canRestart: ["Super Admin", "Infrastructure Admin"].includes(role),
      canSync: ["Super Admin", "Infrastructure Admin", "Trading Admin"].includes(role),
      canDisableTrading: ["Super Admin", "Trading Admin"].includes(role),
      canEmergencyShutdown: role === "Super Admin"
    }
  };
}

export function executionSamples() { return state.executionSamples; }
export function diagnostics() { return state.diagnostics; }
export function incidents() { return state.incidents; }

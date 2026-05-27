import type { AuditRecord, Mt5Role } from "@/modules/mt5-infrastructure-and-broker-connectivity/mt5-control-center/types/mt5-control-center.types";
import { calculateAccountSyncHealth, calculateExposureRisk, classifyReconciliation, recoveryWorkflow, validateTradingReadiness } from "@/modules/mt5-infrastructure-and-broker-connectivity/account-sync/algorithms/account-sync.algorithms";
import type {
  AccountDiagnostic,
  AccountExposure,
  AccountPendingOrder,
  AccountPosition,
  AccountReconciliation,
  AccountSyncResponse,
  AccountSyncLog,
  SyncedAccount
} from "@/modules/mt5-infrastructure-and-broker-connectivity/account-sync/types/account-sync.types";
import type { TerminalPendingOrderUpdatePayload, TerminalPositionUpdatePayload } from "@/modules/mt5-infrastructure-and-broker-connectivity/ea-bridge/types/ea-bridge.types";
import { resolveMt5Role } from "../../_lib/access";
import { bindPersistedMt5State, ensureMt5ModuleHydrated } from "../../_lib/persistence";
import type { AutonomousPipelineSource } from "../../_lib/autonomous-orchestrator";

type AccountSyncState = {
  accounts: SyncedAccount[];
  positions: AccountPosition[];
  orders: AccountPendingOrder[];
  reconciliations: AccountReconciliation[];
  logs: AccountSyncLog[];
  exposures: AccountExposure[];
  diagnostics: AccountDiagnostic[];
  audits: AuditRecord[];
  lastSyncAt: string;
};

const state = bindPersistedMt5State<AccountSyncState>("account-sync", () => ({
  accounts: [],
  positions: [],
  orders: [],
  reconciliations: [],
  logs: [],
  exposures: [],
  diagnostics: [],
  audits: [] as AuditRecord[],
  lastSyncAt: new Date().toISOString()
}));

await ensureMt5ModuleHydrated("account-sync");

export function resetAccountSyncState(override?: Partial<AccountSyncState>) {
  state.accounts = override?.accounts ?? [];
  state.positions = override?.positions ?? [];
  state.orders = override?.orders ?? [];
  state.reconciliations = override?.reconciliations ?? [];
  state.logs = override?.logs ?? [];
  state.exposures = override?.exposures ?? [];
  state.diagnostics = override?.diagnostics ?? [];
  state.audits = [];
  state.lastSyncAt = new Date().toISOString();
}

export function accountRole(request?: Request): Mt5Role {
  return resolveMt5Role(request);
}

const permissions: Record<string, Mt5Role[]> = {
  sync: ["Super Admin", "Infrastructure Admin"],
  diagnostics: ["Super Admin", "Infrastructure Admin"],
  reconcile: ["Super Admin", "Infrastructure Admin", "Risk Manager"],
  tradeControl: ["Super Admin", "Trading Admin"],
  reviewExceptions: ["Super Admin", "Risk Manager"],
  autoRemediate: ["Super Admin", "Infrastructure Admin"]
};
function authorize(role: Mt5Role, action: keyof typeof permissions) {
  if (!permissions[action].includes(role)) throw new Error(`Role "${role}" is not authorized to perform account sync ${action}.`);
}
function confirm(confirmed?: boolean) {
  if (!confirmed) throw new Error("Confirmation is required for this restricted account sync action.");
}
function audit(role: Mt5Role, action: string, entityId: string, oldValue: unknown, newValue: unknown, request?: Request) {
  state.audits.unshift({ id: `account-audit-${Date.now()}-${state.audits.length}`, userId: request?.headers.get("x-user-id") ?? role.toLowerCase().replace(/\s+/g, "-"), action, module: "Account Sync", entityId, oldValue, newValue, ipAddress: request?.headers.get("x-forwarded-for") ?? "system", userAgent: request?.headers.get("user-agent") ?? "autonomous-account-sync", timestamp: new Date().toISOString() });
}
function accountById(id: string) {
  const account = state.accounts.find((item) => item.id === id);
  if (!account) throw new Error("MT5 synchronized account not found.");
  return account;
}
function reconciliationByAccount(id: string) {
  const result = state.reconciliations.find((item) => item.accountId === id);
  if (!result) throw new Error("Account reconciliation record not found.");
  return result;
}
function log(account: SyncedAccount, syncType: AccountSyncLog["syncType"], syncStatus: AccountSyncLog["syncStatus"], explanation: string, error?: string) {
  state.logs.unshift({ id: `log-${Date.now()}-${state.logs.length}`, accountId: account.id, accountLogin: account.accountLogin, brokerName: account.brokerName, syncType, syncStatus, durationMs: account.averageSyncDurationMs, recordsProcessed: account.openPositionsCount + account.pendingOrdersCount + 1, errorCode: error ? "SYNC-EXCEPTION" : undefined, errorMessage: error, retryCount: account.syncRetryCount, resolved: !error, aiExplanation: explanation, createdAt: new Date().toISOString() });
}
function refreshAccount(account: SyncedAccount) {
  const score = calculateAccountSyncHealth(account, reconciliationByAccount(account.id));
  account.syncReliabilityScore = score.score;
  account.riskLevel = score.score < 40 ? "Critical" : score.score < 60 ? "Degraded" : score.score < 75 ? "Watch" : "Healthy";
  return account;
}

export function accounts() { return state.accounts.map(refreshAccount); }

export function removeAccountBindingByLogin(accountLogin: string) {
  const normalized = accountLogin.trim();
  if (!normalized) return 0;
  const accountIds = state.accounts.filter((item) => item.accountLogin === normalized).map((item) => item.id);
  if (!accountIds.length) return 0;
  const accountIdSet = new Set(accountIds);
  state.accounts = state.accounts.filter((item) => item.accountLogin !== normalized);
  state.reconciliations = state.reconciliations.filter((item) => !accountIdSet.has(item.accountId));
  state.positions = state.positions.filter((item) => !accountIdSet.has(item.accountId));
  state.orders = state.orders.filter((item) => !accountIdSet.has(item.accountId));
  state.exposures = state.exposures.filter((item) => !accountIdSet.has(item.accountId));
  return accountIds.length;
}

export function account(id: string) { return refreshAccount(accountById(id)); }
export function positions(id?: string) { return id ? state.positions.filter((item) => item.accountId === id) : state.positions; }
export function orders(id?: string) { return id ? state.orders.filter((item) => item.accountId === id) : state.orders; }
export function exposure(id?: string) { return id ? state.exposures.filter((item) => item.accountId === id) : state.exposures; }
export function reconciliation(id?: string) { return id ? reconciliationByAccount(id) : state.reconciliations; }
export function syncLogs() { return state.logs; }
export function exceptions() { return state.logs.filter((item) => !item.resolved || item.syncStatus === "Failed"); }
export function diagnostics() { return state.diagnostics; }
export function audits() { return state.audits; }

export function provisionAccountBinding(input: {
  accountId: string;
  terminalId: string;
  terminalName: string;
  brokerId: string;
  brokerName: string;
  serverName: string;
  accountLogin: string;
  accountName: string;
  accountType: string;
  currency: string;
  leverage: string;
}, role: Mt5Role, request?: Request) {
  if (!["Super Admin", "Infrastructure Admin"].includes(role)) throw new Error(`Role "${role}" is not authorized to provision account binding.`);
  if (state.accounts.some((item) => item.accountLogin === input.accountLogin || item.terminalId === input.terminalId)) {
    throw new Error("Duplicate terminal account binding.");
  }
  const now = new Date().toISOString();
  const item: SyncedAccount = {
    id: input.accountId, accountId: input.accountId, brokerId: input.brokerId, brokerName: input.brokerName, terminalId: input.terminalId, terminalName: input.terminalName,
    accountLogin: input.accountLogin, accountName: input.accountName, serverName: input.serverName, accountType: input.accountType, currency: input.currency,
    leverage: input.leverage, accountGroup: "Onboarding", accountStatus: "Syncing", balance: 0, equity: 0, credit: 0, margin: 0, freeMargin: 0,
    marginLevel: 0, floatingProfitLoss: 0, realizedProfitLoss: 0, dailyProfitLoss: 0, weeklyProfitLoss: 0, monthlyProfitLoss: 0,
    tradingAllowed: false, expertTradingAllowed: false, longTradesAllowed: false, shortTradesAllowed: false, hedgeModeEnabled: false,
    minimumLotCompatible: false, symbolPermissionsValid: false, riskEngineStatus: "Syncing", eaBridgeLinked: true, openPositionsCount: 0,
    pendingOrdersCount: 0, syncStatus: "Syncing", lastSyncAt: now, lastSuccessfulSyncAt: now, syncDelaySeconds: 0,
    averageSyncDurationMs: 0, syncRetryCount: 0, syncReliabilityScore: 0, dataMismatchCount: 0, riskLevel: "Syncing",
    lastError: "Awaiting initial signed MT5 account snapshot."
  };
  const record: AccountReconciliation = {
    id: `rec-${input.accountId}`, accountId: item.id, accountLogin: item.accountLogin, mt5Balance: 0, nexusBalance: 0, lastSyncedBalance: 0,
    balanceDifference: 0, mt5Equity: 0, nexusEquity: 0, equityDifference: 0, mt5Margin: 0, nexusMargin: 0, marginDifference: 0,
    mt5PositionCount: 0, nexusPositionCount: 0, positionCountDifference: 0, mt5PendingOrderCount: 0, nexusPendingOrderCount: 0,
    pendingOrderCountDifference: 0, profitLossDifference: 0, reconciliationStatus: "Requires Review",
    requiredAction: "Await initial signed MT5 snapshot before enabling trading.", reconciledBy: role, reconciledAt: now
  };
  state.accounts.push(item);
  state.reconciliations.push(record);
  log(item, "Snapshot", "Pending", "Account binding provisioned; waiting for a verified terminal snapshot.");
  audit(role, "Account binding provisioned", item.id, null, { terminalId: item.terminalId, accountLogin: item.accountLogin, tradingAllowed: false }, request);
  return item;
}

export function syncAccount(id: string, role: Mt5Role, confirmed: boolean, request?: Request) {
  authorize(role, "sync"); confirm(confirmed);
  const item = account(id);
  const old = { syncStatus: item.syncStatus, lastSyncAt: item.lastSyncAt, retryCount: item.syncRetryCount };
  item.syncStatus = item.accountStatus === "Critical" ? "Critical" : "Healthy";
  item.lastSyncAt = new Date().toISOString();
  item.syncDelaySeconds = 0;
  item.syncRetryCount += old.syncStatus === "Healthy" ? 0 : 1;
  if (item.accountStatus !== "Critical") item.lastSuccessfulSyncAt = item.lastSyncAt;
  log(item, "Snapshot", item.accountStatus === "Critical" ? "Failed" : "Successful", item.accountStatus === "Critical" ? "Authentication remains unavailable; data retained as unsafe." : "Latest terminal snapshot ingested.", item.accountStatus === "Critical" ? item.lastError : undefined);
  audit(role, "Account snapshot synchronized", id, old, { syncStatus: item.syncStatus, lastSyncAt: item.lastSyncAt }, request);
  return item;
}
export function syncAllAccounts(role: Mt5Role, confirmed: boolean, request?: Request) {
  authorize(role, "sync");
  if (confirmed === false) confirm(confirmed);
  state.accounts.forEach((item) => syncAccount(item.id, role, true, request));
  autonomousReconcileAccounts("account-snapshot");
  audit(role, "All accounts synchronized", "all-accounts", null, { count: state.accounts.length }, request);
  return accounts();
}
export function syncSelectedAccounts(ids: string[], role: Mt5Role, confirmed: boolean, request?: Request) {
  authorize(role, "sync"); confirm(confirmed);
  if (!ids.length) throw new Error("At least one account must be selected for synchronization.");
  const result = ids.map((id) => syncAccount(id, role, true, request));
  audit(role, "Selected accounts synchronized", ids.join(","), null, { count: ids.length }, request);
  return result;
}
export function syncTradingState(id: string, kind: "positions" | "orders", role: Mt5Role, confirmed: boolean, request?: Request) {
  authorize(role, "sync"); confirm(confirmed);
  const item = account(id);
  const records = kind === "positions" ? positions(id) : orders(id);
  records.forEach((record) => {
    record.syncStatus = item.accountStatus === "Critical" ? "Critical" : "Healthy";
    record.lastSyncAt = new Date().toISOString();
  });
  log(item, kind === "positions" ? "Position Sync" : "Order Sync", item.accountStatus === "Critical" ? "Failed" : "Successful", `${kind} synchronization ${item.accountStatus === "Critical" ? "failed pending authentication" : "completed"}.`, item.accountStatus === "Critical" ? item.lastError : undefined);
  audit(role, `Account ${kind} synchronized`, id, null, { records: records.length }, request);
  return records;
}
export function reconcileAccount(id: string, role: Mt5Role, confirmed: boolean, request?: Request) {
  authorize(role, "reconcile"); confirm(confirmed);
  const item = account(id);
  const record = reconciliationByAccount(id);
  const result = classifyReconciliation(record);
  const old = record.reconciliationStatus;
  record.reconciliationStatus = result.status;
  record.requiredAction = result.action;
  record.reconciledBy = role;
  record.reconciledAt = new Date().toISOString();
  log(item, "Reconciliation", result.status === "Matched" ? "Successful" : "Failed", result.action, result.status === "Matched" ? undefined : `Reconciliation status: ${result.status}`);
  audit(role, "Account balance reconciled", id, old, result.status, request);
  return record;
}
export function reconcileAll(role: Mt5Role, confirmed: boolean, request?: Request) {
  authorize(role, "reconcile");
  if (confirmed === false) confirm(confirmed);
  autonomousReconcileAccounts("account-snapshot");
  audit(role, "All account balances reconciled", "all-accounts", null, { count: state.accounts.length }, request);
  return state.reconciliations;
}

export function autonomousReconcileAccounts(_source: AutonomousPipelineSource) {
  state.accounts.forEach((item) => {
    const record = reconciliationByAccount(item.id);
    const result = classifyReconciliation(record);
    record.reconciliationStatus = result.status;
    record.requiredAction = result.action;
    record.reconciledBy = "autonomous-sync";
    record.reconciledAt = new Date().toISOString();
  });
  state.lastSyncAt = new Date().toISOString();
  return accounts();
}
export function setAccountTrading(id: string, enabled: boolean, role: Mt5Role, confirmed: boolean, request?: Request) {
  authorize(role, "tradeControl"); confirm(confirmed);
  const item = account(id);
  if (enabled) {
    const readiness = validateTradingReadiness({ ...item, tradingAllowed: true });
    if (!readiness.executionReady) throw new Error(`Trading enable blocked: ${readiness.failures.join(", ")}.`);
  }
  const old = item.tradingAllowed;
  item.tradingAllowed = enabled;
  log(item, "Permission Sync", "Successful", `Account trading permission ${enabled ? "enabled" : "disabled"} by controlled action.`);
  audit(role, enabled ? "Account trading enabled" : "Account trading disabled", id, old, enabled, request);
  return item;
}
export function runAccountDiagnostics(id: string | null, role: Mt5Role, confirmed: boolean, request?: Request) {
  authorize(role, "diagnostics"); confirm(confirmed);
  const findings = id ? state.diagnostics.filter((item) => item.accountId === id) : state.diagnostics;
  audit(role, "Account diagnostics run", id ?? "all-accounts", null, { findings: findings.length }, request);
  return { completedAt: new Date().toISOString(), diagnostics: findings };
}
export function autoRemediateAccount(diagnosticId: string, role: Mt5Role, confirmed: boolean, request?: Request) {
  authorize(role, "autoRemediate"); confirm(confirmed);
  const diagnostic = state.diagnostics.find((item) => item.id === diagnosticId);
  if (!diagnostic) throw new Error("Account diagnostic not found.");
  if (!diagnostic.autoFixEligible) throw new Error("Auto-remediation is unavailable for this account issue.");
  const item = account(diagnostic.accountId);
  if (diagnostic.severity === "Critical") item.tradingAllowed = false;
  diagnostic.autoFixStatus = "Running";
  audit(role, "Account auto-remediation triggered", diagnosticId, "Available", { status: "Running", tradingAllowed: item.tradingAllowed }, request);
  return { account: item, diagnostic, workflow: recoveryWorkflow(item) };
}

export function buildAccountSyncResponse(role: Mt5Role = "Infrastructure Admin"): AccountSyncResponse {
  const items = accounts();
  const now = new Date().toISOString();
  const total = (select: (item: SyncedAccount) => number) => items.reduce((sum, item) => sum + select(item), 0);
  const exposureSummaries = items.map((item) => calculateExposureRisk(item, state.exposures));
  const highestRisk = [...items].sort((left, right) => left.syncReliabilityScore - right.syncReliabilityScore)[0];
  const failed = items.filter((item) => item.syncStatus === "Critical").length;
  const workflow = ["Account Registered", "Broker Login Verified", "Account Snapshot Pulled", "Balance/Equity Synced", "Positions Synced", "Pending Orders Synced", "Permissions Verified", "Exposure Calculated", "Risk Engine Updated", "Audit Logged"];
  return {
    meta: { timestamp: now, currentRole: role, streamEndpoint: "/api/mt5/account-sync/events-stream", monitoringMode: "Autonomous Account Reconciliation" },
    kpis: [
      { label: "Total MT5 Accounts", value: String(items.length), status: "Healthy", detail: "Registered account bindings", updatedAt: now },
      { label: "Synced Accounts", value: String(items.filter((item) => item.syncStatus === "Healthy").length), status: "Healthy", detail: "Current snapshots", updatedAt: now },
      { label: "Pending Sync", value: String(items.filter((item) => item.syncStatus === "Degraded").length), status: "Degraded", detail: "Delayed reconciliation", updatedAt: now },
      { label: "Failed Sync", value: String(failed), status: failed ? "Critical" : "Healthy", detail: "Unsafe snapshots", updatedAt: now },
      { label: "Trading Enabled Accounts", value: String(items.filter((item) => item.tradingAllowed).length), status: "Healthy", detail: "Execution permitted", updatedAt: now },
      { label: "Trading Disabled Accounts", value: String(items.filter((item) => !item.tradingAllowed).length), status: "Critical", detail: "Risk blocks active", updatedAt: now },
      { label: "Total Balance", value: `$${total((item) => item.balance).toLocaleString()}`, status: "Healthy", detail: "MT5 balance", updatedAt: now },
      { label: "Total Equity", value: `$${total((item) => item.equity).toLocaleString()}`, status: "Degraded", detail: "Live equity", updatedAt: now },
      { label: "Total Margin Used", value: `$${total((item) => item.margin).toLocaleString()}`, status: "Watch", detail: "Allocated margin", updatedAt: now },
      { label: "Total Free Margin", value: `$${total((item) => item.freeMargin).toLocaleString()}`, status: "Healthy", detail: "Available collateral", updatedAt: now },
      { label: "Average Sync Delay", value: `${Math.round(total((item) => item.syncDelaySeconds) / items.length)} sec`, status: "Degraded", detail: "Snapshot freshness", updatedAt: now },
      { label: "Highest Risk Account", value: highestRisk.accountLogin, status: "Critical", detail: `${highestRisk.brokerName} / ${highestRisk.syncReliabilityScore}`, updatedAt: now }
    ],
    workflow: workflow.map((title, index) => ({ title, status: index > 0 && failed ? index >= 6 ? "Critical" : "Degraded" : "Healthy", accountCount: items.length - (index > 0 ? failed : 0), failureCount: index ? failed : 0, averageDelayMs: Math.round(total((item) => item.averageSyncDurationMs) / items.length), lastSyncAt: now, aiRecommendation: index === 6 && failed ? "Preserve FTMO execution block until reconciliation succeeds." : undefined })),
    accounts: items, positions: state.positions, orders: state.orders, reconciliations: state.reconciliations, logs: state.logs, exposures: state.exposures, exposureSummaries, diagnostics: state.diagnostics, audits: state.audits,
    permissions: { role, canSync: permissions.sync.includes(role), canDiagnostics: permissions.diagnostics.includes(role), canReconcile: permissions.reconcile.includes(role), canTradeControl: permissions.tradeControl.includes(role), canReviewExceptions: permissions.reviewExceptions.includes(role), canAutoRemediate: permissions.autoRemediate.includes(role) }
  };
}
export function accountSummary(role: Mt5Role) {
  const response = buildAccountSyncResponse(role);
  return { meta: response.meta, kpis: response.kpis, workflow: response.workflow, permissions: response.permissions };
}

export function ingestTerminalAccountSnapshot(input: {
  accountLogin: string;
  balance: number;
  equity: number;
  credit: number;
  margin: number;
  freeMargin: number;
  marginLevel: number;
  floatingProfitLoss: number;
  openPositionsCount: number;
  pendingOrdersCount: number;
  tradingAllowed: boolean;
  expertTradingAllowed: boolean;
}) {
  const item = state.accounts.find((candidate) => candidate.accountLogin === input.accountLogin);
  if (!item) throw new Error("Terminal account snapshot is not bound to a registered Nexus account.");
  const record = reconciliationByAccount(item.id);
  const initialOnboardingSnapshot = item.accountGroup === "Onboarding" && item.lastError === "Awaiting initial signed MT5 account snapshot.";
  const old = { balance: item.balance, equity: item.equity, margin: item.margin, openPositionsCount: item.openPositionsCount, pendingOrdersCount: item.pendingOrdersCount };
  record.mt5Balance = input.balance;
  if (initialOnboardingSnapshot) {
    record.nexusBalance = input.balance;
    record.lastSyncedBalance = input.balance;
    record.nexusEquity = input.equity;
    record.nexusMargin = input.margin;
    record.nexusPositionCount = input.openPositionsCount;
    record.nexusPendingOrderCount = input.pendingOrdersCount;
  }
  record.balanceDifference = input.balance - record.nexusBalance;
  record.mt5Equity = input.equity;
  record.equityDifference = input.equity - record.nexusEquity;
  record.mt5Margin = input.margin;
  record.marginDifference = input.margin - record.nexusMargin;
  record.mt5PositionCount = input.openPositionsCount;
  record.positionCountDifference = input.openPositionsCount - record.nexusPositionCount;
  record.mt5PendingOrderCount = input.pendingOrdersCount;
  record.pendingOrderCountDifference = input.pendingOrdersCount - record.nexusPendingOrderCount;
  record.profitLossDifference = initialOnboardingSnapshot ? 0 : input.floatingProfitLoss - item.floatingProfitLoss;
  const comparison = classifyReconciliation(record);
  record.reconciliationStatus = comparison.status;
  record.requiredAction = comparison.action;
  record.reconciledBy = "mt5-ea-bridge";
  record.reconciledAt = new Date().toISOString();
  const onboarded = item.accountGroup === "Onboarding";
  Object.assign(item, input, { lastSyncAt: record.reconciledAt, lastSuccessfulSyncAt: record.reconciledAt, syncDelaySeconds: 0, syncStatus: comparison.status === "Material Difference" ? "Degraded" : "Healthy" });
  item.accountStatus = "Healthy";
  if (initialOnboardingSnapshot) item.lastError = undefined;
  item.dataMismatchCount = comparison.status === "Matched" ? 0 : item.dataMismatchCount + 1;
  if (comparison.status === "Material Difference" || onboarded) item.tradingAllowed = false;
  log(item, "Snapshot", comparison.status === "Matched" ? "Successful" : "Failed", comparison.action, comparison.status === "Matched" ? undefined : `Terminal reconciliation: ${comparison.status}`);
  audit("Infrastructure Admin", "Terminal account snapshot ingested", item.id, old, { balance: item.balance, equity: item.equity, reconciliationStatus: comparison.status });
  return { account: refreshAccount(item), reconciliation: record };
}

function normalizeSymbol(symbol: string) {
  return symbol.replace(/(\.(raw|pro|m|ecn|i|c|zero|micro|mini|std|pro\.|ecn\.|raw\.|m\.|i\.|c\.|zero\.|micro\.|mini\.|std\.))$/i, "").replace(/[^A-Za-z0-9]/g, "");
}

export function ingestTerminalPositionUpdates(input: TerminalPositionUpdatePayload) {
  const item = state.accounts.find((candidate) => candidate.accountLogin === input.accountLogin);
  if (!item) throw new Error("Terminal position update is not bound to a registered Nexus account.");
  const record = reconciliationByAccount(item.id);
  const now = new Date().toISOString();
  state.positions = state.positions.filter((position) => position.accountLogin !== input.accountLogin);
  for (const position of input.positions) {
    state.positions.unshift({
      id: `pos-${item.id}-${position.positionTicket}`,
      accountId: item.id,
      accountLogin: item.accountLogin,
      brokerId: item.brokerId,
      terminalId: item.terminalId,
      positionTicket: position.positionTicket,
      symbol: position.symbol,
      normalizedSymbol: normalizeSymbol(position.symbol),
      direction: position.direction,
      volume: position.volume,
      entryPrice: position.entryPrice,
      currentPrice: position.currentPrice,
      stopLoss: position.stopLoss,
      takeProfit: position.takeProfit,
      profitLoss: position.profitLoss,
      swap: position.swap,
      commission: position.commission,
      openTime: position.openTime,
      syncStatus: "Healthy",
      lastSyncAt: now
    });
  }
  item.openPositionsCount = input.positions.length;
  record.mt5PositionCount = input.positions.length;
  record.positionCountDifference = input.positions.length - record.nexusPositionCount;
  item.lastSyncAt = now;
  item.lastSuccessfulSyncAt = now;
  log(item, "Position Sync", "Successful", `Synchronized ${input.positions.length} open position(s) from MT5 terminal.`);
  audit("Infrastructure Admin", "Terminal position update ingested", item.id, null, { count: input.positions.length });
  return { account: refreshAccount(item), positions: input.positions.length };
}

export function ingestTerminalPendingOrderUpdates(input: TerminalPendingOrderUpdatePayload) {
  const item = state.accounts.find((candidate) => candidate.accountLogin === input.accountLogin);
  if (!item) throw new Error("Terminal pending order update is not bound to a registered Nexus account.");
  const record = reconciliationByAccount(item.id);
  const now = new Date().toISOString();
  state.orders = state.orders.filter((order) => order.accountLogin !== input.accountLogin);
  for (const order of input.orders) {
    state.orders.unshift({
      id: `ord-${item.id}-${order.orderTicket}`,
      accountId: item.id,
      accountLogin: item.accountLogin,
      brokerId: item.brokerId,
      terminalId: item.terminalId,
      orderTicket: order.orderTicket,
      symbol: order.symbol,
      normalizedSymbol: normalizeSymbol(order.symbol),
      orderType: order.orderType,
      direction: order.direction,
      volume: order.volume,
      price: order.price,
      stopLoss: order.stopLoss,
      takeProfit: order.takeProfit,
      expiryTime: order.expiryTime ?? "",
      orderStatus: "Pending",
      syncStatus: "Healthy",
      lastSyncAt: now
    });
  }
  item.pendingOrdersCount = input.orders.length;
  record.mt5PendingOrderCount = input.orders.length;
  record.pendingOrderCountDifference = input.orders.length - record.nexusPendingOrderCount;
  item.lastSyncAt = now;
  item.lastSuccessfulSyncAt = now;
  log(item, "Order Sync", "Successful", `Synchronized ${input.orders.length} pending order(s) from MT5 terminal.`);
  audit("Infrastructure Admin", "Terminal pending order update ingested", item.id, null, { count: input.orders.length });
  return { account: refreshAccount(item), orders: input.orders.length };
}

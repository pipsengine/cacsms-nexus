import type { AuditRecord, Mt5Role } from "@/modules/mt5-infrastructure-and-broker-connectivity/mt5-control-center/types/mt5-control-center.types";
import {
  buildAccountCenterWorkflow,
  buildGroupSummaries,
  computeDefaultAllocation,
  exportAccountsToCsv,
  mapSyncedAccountToPortfolio,
  portfolioHealthScore
} from "@/modules/accounts-and-portfolio/account-center/algorithms/account-center.algorithms";
import type {
  AccountCenterResponse,
  AccountCenterSummaryResponse,
  AccountSwitchEvent,
  PortfolioAccount
} from "@/modules/accounts-and-portfolio/account-center/types/account-center.types";
import { resolveMt5Role } from "../../../mt5/_lib/access";
import { bindPersistedPortfolioState, ensurePortfolioModuleHydrated } from "../../_lib/persistence";

type AccountCenterState = {
  activeAccountId: string | null;
  switchHistory: AccountSwitchEvent[];
  pinnedAccountIds: string[];
  allocationOverrides: Record<string, number>;
  audits: AuditRecord[];
};

const state = bindPersistedPortfolioState<AccountCenterState>("account-center", () => ({
  activeAccountId: null,
  switchHistory: [],
  pinnedAccountIds: [],
  allocationOverrides: {},
  audits: []
}));

await ensurePortfolioModuleHydrated("account-center");

export function resetAccountCenterState(override?: Partial<AccountCenterState>) {
  state.activeAccountId = override?.activeAccountId ?? null;
  state.switchHistory = override?.switchHistory ?? [];
  state.pinnedAccountIds = override?.pinnedAccountIds ?? [];
  state.allocationOverrides = override?.allocationOverrides ?? {};
  state.audits = override?.audits ?? [];
}

export function accountCenterRole(request?: Request): Mt5Role {
  return resolveMt5Role(request);
}

const permissions: Record<"switch" | "pin" | "export" | "allocation", Mt5Role[]> = {
  switch: ["Super Admin", "Infrastructure Admin", "Trading Admin", "Risk Manager"],
  pin: ["Super Admin", "Infrastructure Admin", "Trading Admin"],
  export: ["Super Admin", "Infrastructure Admin", "Trading Admin", "Risk Manager", "Analyst", "Read-Only Viewer"],
  allocation: ["Super Admin", "Infrastructure Admin", "Risk Manager"]
};

function authorize(role: Mt5Role, action: keyof typeof permissions) {
  if (!permissions[action].includes(role)) {
    throw new Error(`Role "${role}" is not authorized to perform account center ${action}.`);
  }
}

function confirm(confirmed?: boolean) {
  if (!confirmed) throw new Error("Confirmation is required for this restricted account center action.");
}

function audit(role: Mt5Role, action: string, entityId: string, oldValue: unknown, newValue: unknown, request?: Request) {
  state.audits.unshift({
    id: `acct-center-audit-${Date.now()}-${state.audits.length}`,
    userId: request?.headers.get("x-user-id") ?? role.toLowerCase().replace(/\s+/g, "-"),
    action,
    module: "Account Center",
    entityId,
    oldValue,
    newValue,
    ipAddress: request?.headers.get("x-forwarded-for") ?? "system",
    userAgent: request?.headers.get("user-agent") ?? "account-center",
    timestamp: new Date().toISOString()
  });
  state.audits = state.audits.slice(0, 200);
}

async function loadSyncedAccounts() {
  const { accounts } = await import("../../../mt5/account-sync/_lib/store");
  return accounts();
}

function mapAccounts(synced: Awaited<ReturnType<typeof loadSyncedAccounts>>): PortfolioAccount[] {
  const defaultAllocation = computeDefaultAllocation(synced.length);
  if (!state.activeAccountId && synced[0]) {
    state.activeAccountId = synced[0].id;
  }
  return synced
    .map((account) =>
      mapSyncedAccountToPortfolio(account, {
        activeAccountId: state.activeAccountId,
        pinnedAccountIds: state.pinnedAccountIds,
        allocationOverrides: state.allocationOverrides,
        defaultAllocation
      })
    )
    .sort((left, right) => Number(right.isActive) - Number(left.isActive) || right.equity - left.equity);
}

function quickLinks(activeAccountId: string | null) {
  const portfolioHref = activeAccountId
    ? `/accounts-and-portfolio/portfolio-dashboard?accountId=${encodeURIComponent(activeAccountId)}`
    : "/accounts-and-portfolio/portfolio-dashboard";
  return [
    {
      label: "Portfolio Dashboard",
      href: portfolioHref,
      description: "Cross-account equity, allocation mix, and performance analytics."
    },
    {
      label: "MT5 Account Sync",
      href: "/mt5-infrastructure-and-broker-connectivity/account-sync",
      description: "Live MT5 synchronization, reconciliation, and trading permission controls."
    },
    {
      label: "Risk & Exposure",
      href: "/accounts-and-portfolio/risk-and-exposure",
      description: "Combined margin, leverage, and exposure monitoring (planned)."
    },
    {
      label: "Account History",
      href: "/accounts-and-portfolio/account-history",
      description: "Funding events and workspace change timeline (planned)."
    }
  ];
}

export async function buildAccountCenterResponse(role: Mt5Role = "Infrastructure Admin"): Promise<AccountCenterResponse> {
  const synced = await loadSyncedAccounts();
  const accounts = mapAccounts(synced);
  const activeAccount = accounts.find((account) => account.isActive) ?? null;
  const now = new Date().toISOString();
  const totalEquity = accounts.reduce((sum, account) => sum + account.equity, 0);
  const totalBalance = accounts.reduce((sum, account) => sum + account.balance, 0);
  const healthScore = portfolioHealthScore(accounts);
  const healthTone = healthScore >= 75 ? "Healthy" : healthScore >= 60 ? "Watch" : healthScore >= 40 ? "Degraded" : "Critical";

  return {
    meta: {
      timestamp: now,
      currentRole: role,
      streamEndpoint: "/api/accounts-and-portfolio/account-center/events-stream",
      monitoringMode: "Autonomous Portfolio Workspace",
      activeAccountId: state.activeAccountId
    },
    kpis: [
      { label: "Total Accounts", value: String(accounts.length), status: accounts.length ? "Healthy" : "Watch", detail: "Linked MT5 and broker accounts", updatedAt: now },
      { label: "Active Workspace Account", value: activeAccount?.accountLogin ?? "None", status: activeAccount ? "Healthy" : "Watch", detail: activeAccount?.accountName ?? "Select an account to activate workspace context", updatedAt: now },
      { label: "Aggregate Equity", value: `$${totalEquity.toLocaleString()}`, status: "Healthy", detail: "Combined live equity", updatedAt: now },
      { label: "Aggregate Balance", value: `$${totalBalance.toLocaleString()}`, status: "Healthy", detail: "Combined MT5 balance", updatedAt: now },
      { label: "Trading Enabled", value: String(accounts.filter((account) => account.tradingAllowed).length), status: "Healthy", detail: "Accounts permitted to route orders", updatedAt: now },
      { label: "Switchable Accounts", value: String(accounts.filter((account) => account.switchable).length), status: "Healthy", detail: "Ready for workspace activation", updatedAt: now },
      { label: "Live Accounts", value: String(accounts.filter((account) => account.portfolioCategory === "Live").length), status: "Healthy", detail: "Production execution accounts", updatedAt: now },
      { label: "Prop Firm Accounts", value: String(accounts.filter((account) => account.portfolioCategory === "Prop Firm").length), status: "Watch", detail: "Evaluation and funded programs", updatedAt: now },
      { label: "Pinned Accounts", value: String(accounts.filter((account) => account.isPinned).length), status: "Healthy", detail: "Operator-pinned inventory", updatedAt: now },
      { label: "Portfolio Health", value: `${healthScore}/100`, status: healthTone, detail: "Reliability, sync freshness, and switch readiness", updatedAt: now },
      { label: "Recent Switches", value: String(state.switchHistory.length), status: "Healthy", detail: "Audited workspace context changes", updatedAt: now },
      { label: "Blocked Switches", value: String(accounts.filter((account) => !account.switchable).length), status: accounts.some((account) => !account.switchable) ? "Degraded" : "Healthy", detail: "Accounts blocked by sync or risk posture", updatedAt: now }
    ],
    workflow: buildAccountCenterWorkflow(accounts),
    accounts,
    groups: buildGroupSummaries(accounts),
    activeAccount,
    switchHistory: state.switchHistory.slice(0, 50),
    quickLinks: quickLinks(state.activeAccountId),
    permissions: {
      role,
      canSwitch: permissions.switch.includes(role),
      canPin: permissions.pin.includes(role),
      canExport: permissions.export.includes(role),
      canManageAllocation: permissions.allocation.includes(role)
    },
    audits: state.audits
  };
}

export async function accountCenterSummary(role: Mt5Role): Promise<AccountCenterSummaryResponse> {
  const response = await buildAccountCenterResponse(role);
  return {
    meta: response.meta,
    kpis: response.kpis,
    groups: response.groups,
    activeAccount: response.activeAccount,
    permissions: response.permissions
  };
}

export async function accountDetail(accountId: string, role: Mt5Role) {
  const response = await buildAccountCenterResponse(role);
  const account = response.accounts.find((item) => item.id === accountId || item.accountId === accountId);
  if (!account) throw new Error("Account not found.");
  return { meta: { timestamp: response.meta.timestamp }, account };
}

export async function activateAccount(accountId: string, role: Mt5Role, confirmed: boolean, request?: Request, reason = "Operator workspace switch") {
  authorize(role, "switch");
  confirm(confirmed);
  const synced = await loadSyncedAccounts();
  const accounts = mapAccounts(synced);
  const next = accounts.find((item) => item.id === accountId || item.accountId === accountId);
  if (!next) throw new Error("Account not found.");
  if (!next.switchable) throw new Error(next.switchBlockReason ?? "Account cannot be activated in the current state.");

  const previousAccountId = state.activeAccountId;
  state.activeAccountId = next.id;
  const event: AccountSwitchEvent = {
    id: `switch-${Date.now()}-${state.switchHistory.length}`,
    accountId: next.id,
    accountLogin: next.accountLogin,
    accountName: next.accountName,
    brokerName: next.brokerName,
    portfolioCategory: next.portfolioCategory,
    switchedAt: new Date().toISOString(),
    switchedBy: role,
    reason,
    previousAccountId
  };
  state.switchHistory.unshift(event);
  state.switchHistory = state.switchHistory.slice(0, 100);
  audit(role, "Active workspace account switched", next.id, previousAccountId, next.id, request);
  return { ok: true, activeAccountId: next.id, event, account: { ...next, isActive: true } };
}

export async function pinAccount(accountId: string, pinned: boolean, role: Mt5Role, confirmed: boolean, request?: Request) {
  authorize(role, "pin");
  confirm(confirmed);
  const synced = await loadSyncedAccounts();
  const target = synced.find((item) => item.id === accountId || item.accountId === accountId);
  if (!target) throw new Error("Account not found.");
  const set = new Set(state.pinnedAccountIds);
  if (pinned) set.add(target.id);
  else set.delete(target.id);
  state.pinnedAccountIds = [...set];
  audit(role, pinned ? "Account pinned" : "Account unpinned", target.id, !pinned, pinned, request);
  return { ok: true, pinned, accountId: target.id };
}

export async function setAllocation(accountId: string, allocationPercent: number, role: Mt5Role, confirmed: boolean, request?: Request) {
  authorize(role, "allocation");
  confirm(confirmed);
  if (!Number.isFinite(allocationPercent) || allocationPercent < 0 || allocationPercent > 100) {
    throw new Error("Allocation must be between 0 and 100.");
  }
  const synced = await loadSyncedAccounts();
  const target = synced.find((item) => item.id === accountId || item.accountId === accountId);
  if (!target) throw new Error("Account not found.");
  state.allocationOverrides[target.id] = Number(allocationPercent.toFixed(1));
  audit(role, "Account allocation updated", target.id, null, allocationPercent, request);
  return { ok: true, accountId: target.id, allocationPercent: state.allocationOverrides[target.id] };
}

export type AccountCenterExportRequest = {
  format?: "json" | "csv";
  category?: PortfolioAccount["portfolioCategory"] | "All";
  search?: string;
};

export async function exportAccountCenter(payload: AccountCenterExportRequest, role: Mt5Role, request?: Request) {
  authorize(role, "export");
  const response = await buildAccountCenterResponse(role);
  let accounts = response.accounts;
  if (payload.category && payload.category !== "All") {
    accounts = accounts.filter((account) => account.portfolioCategory === payload.category);
  }
  if (payload.search?.trim()) {
    const needle = payload.search.trim().toLowerCase();
    accounts = accounts.filter((account) =>
      `${account.accountLogin} ${account.accountName} ${account.brokerName} ${account.terminalName}`.toLowerCase().includes(needle)
    );
  }
  const format = payload.format ?? "json";
  const generatedAt = new Date().toISOString();
  const content =
    format === "csv"
      ? exportAccountsToCsv(accounts)
      : JSON.stringify(
          {
            generatedAt,
            total: accounts.length,
            activeAccountId: response.meta.activeAccountId,
            accounts,
            switchHistory: response.switchHistory,
            groups: response.groups
          },
          null,
          2
        );
  audit(role, "EXPORT_ACCOUNT_CENTER", "EXPORT", null, { format, total: accounts.length }, request);
  return {
    meta: { timestamp: generatedAt },
    ok: true,
    message: content,
    format,
    total: accounts.length,
    filename: `account-center-${generatedAt.slice(0, 10)}.${format === "csv" ? "csv" : "json"}`
  };
}

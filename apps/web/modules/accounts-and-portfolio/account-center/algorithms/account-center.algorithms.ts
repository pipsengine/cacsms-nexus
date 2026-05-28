import type { SyncedAccount } from "@/modules/mt5-infrastructure-and-broker-connectivity/account-sync/types/account-sync.types";
import type {
  AccountCenterGroupSummary,
  AccountCenterWorkflowNode,
  PortfolioAccount,
  PortfolioCategory
} from "../types/account-center.types";

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

export function classifyPortfolioCategory(accountType: string): PortfolioCategory {
  const normalized = accountType.toLowerCase();
  if (normalized.includes("prop") || normalized.includes("evaluation") || normalized.includes("challenge")) return "Prop Firm";
  if (normalized.includes("demo")) return "Demo";
  if (normalized.includes("paper")) return "Paper";
  if (normalized.includes("live") || normalized.includes("raw") || normalized.includes("razor") || normalized.includes("prime")) return "Live";
  if (normalized.includes("broker")) return "Broker";
  return "Unknown";
}

export function deriveAccountTags(account: SyncedAccount, category: PortfolioCategory) {
  const tags = [category];
  if (account.eaBridgeLinked) tags.push("EA Linked");
  if (account.tradingAllowed) tags.push("Trading On");
  if (account.syncStatus !== "Healthy") tags.push("Sync Watch");
  if (account.riskLevel === "Critical") tags.push("Risk Critical");
  return tags;
}

export function evaluateSwitchEligibility(account: SyncedAccount) {
  if (account.syncStatus === "Critical" || account.syncStatus === "Offline") {
    return { switchable: false, reason: "Account snapshot is stale or offline." };
  }
  if (!account.tradingAllowed && account.riskLevel === "Critical") {
    return { switchable: false, reason: "Trading disabled by risk controls." };
  }
  return { switchable: true, reason: "Ready for workspace activation." };
}

export function mapSyncedAccountToPortfolio(
  account: SyncedAccount,
  input: {
    activeAccountId: string | null;
    pinnedAccountIds: string[];
    allocationOverrides: Record<string, number>;
    defaultAllocation: number;
  }
): PortfolioAccount {
  const category = classifyPortfolioCategory(account.accountType);
  const eligibility = evaluateSwitchEligibility(account);
  return {
    id: account.id,
    accountId: account.accountId,
    accountLogin: account.accountLogin,
    accountName: account.accountName,
    brokerId: account.brokerId,
    brokerName: account.brokerName,
    terminalId: account.terminalId,
    terminalName: account.terminalName,
    serverName: account.serverName,
    accountType: account.accountType,
    portfolioCategory: category,
    currency: account.currency,
    leverage: account.leverage,
    balance: account.balance,
    equity: account.equity,
    margin: account.margin,
    freeMargin: account.freeMargin,
    marginLevel: account.marginLevel,
    floatingProfitLoss: account.floatingProfitLoss,
    dailyProfitLoss: account.dailyProfitLoss,
    monthlyProfitLoss: account.monthlyProfitLoss,
    tradingAllowed: account.tradingAllowed,
    expertTradingAllowed: account.expertTradingAllowed,
    syncStatus: account.syncStatus,
    riskLevel: account.riskLevel,
    syncReliabilityScore: account.syncReliabilityScore,
    syncDelaySeconds: account.syncDelaySeconds,
    openPositionsCount: account.openPositionsCount,
    pendingOrdersCount: account.pendingOrdersCount,
    eaBridgeLinked: account.eaBridgeLinked,
    lastSyncAt: account.lastSyncAt,
    isActive: account.id === input.activeAccountId,
    isPinned: input.pinnedAccountIds.includes(account.id),
    allocationPercent: input.allocationOverrides[account.id] ?? input.defaultAllocation,
    switchable: eligibility.switchable,
    switchBlockReason: eligibility.switchable ? undefined : eligibility.reason,
    tags: deriveAccountTags(account, category)
  };
}

export function buildGroupSummaries(accounts: PortfolioAccount[]): AccountCenterGroupSummary[] {
  const categories: Array<PortfolioCategory | "All"> = ["All", "Live", "Broker", "Prop Firm", "Demo", "Paper"];
  return categories.map((category) => {
    const scoped = category === "All" ? accounts : accounts.filter((account) => account.portfolioCategory === category);
    return {
      category,
      count: scoped.length,
      totalEquity: scoped.reduce((sum, account) => sum + account.equity, 0),
      tradingEnabledCount: scoped.filter((account) => account.tradingAllowed).length,
      healthyCount: scoped.filter((account) => account.syncStatus === "Healthy" && account.riskLevel !== "Critical").length
    };
  });
}

export function buildAccountCenterWorkflow(accounts: PortfolioAccount[]): AccountCenterWorkflowNode[] {
  const blocked = accounts.filter((account) => !account.switchable).length;
  const active = accounts.find((account) => account.isActive);
  const step = (title: string, status: AccountCenterWorkflowNode["status"], blockedCount: number, detail: string): AccountCenterWorkflowNode => ({
    title,
    status,
    accountCount: accounts.length,
    blockedCount,
    detail
  });

  return [
    step("Inventory Aggregated", accounts.length ? "Healthy" : "Watch", 0, "Accounts collected from MT5 sync and broker bindings."),
    step("Identity Validated", accounts.some((a) => a.syncStatus === "Critical") ? "Degraded" : "Healthy", accounts.filter((a) => a.syncStatus === "Critical").length, "Login, broker, and terminal metadata verified."),
    step("Financial Snapshot", accounts.some((a) => a.syncDelaySeconds > 120) ? "Watch" : "Healthy", accounts.filter((a) => a.syncDelaySeconds > 120).length, "Balance, equity, and margin refreshed from live telemetry."),
    step("Risk & Permissions", blocked > 0 ? "Degraded" : "Healthy", blocked, "Trading permissions and risk posture evaluated per account."),
    step("Workspace Active Account", active ? "Healthy" : "Watch", active ? 0 : 1, active ? `${active.accountLogin} is the current workspace context.` : "No active workspace account selected."),
    step("Switch History Audited", "Healthy", 0, "Account switches recorded for operator traceability.")
  ];
}

export function computeDefaultAllocation(accountCount: number) {
  if (accountCount <= 0) return 0;
  return Number((100 / accountCount).toFixed(1));
}

export function portfolioHealthScore(accounts: PortfolioAccount[]) {
  if (!accounts.length) return 0;
  const avgReliability = accounts.reduce((sum, account) => sum + account.syncReliabilityScore, 0) / accounts.length;
  const healthyRatio = accounts.filter((account) => account.syncStatus === "Healthy").length / accounts.length;
  const switchableRatio = accounts.filter((account) => account.switchable).length / accounts.length;
  return Math.round(clamp(avgReliability * 0.55 + healthyRatio * 25 + switchableRatio * 20, 0, 100));
}

function csvEscape(value: unknown) {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function exportAccountsToCsv(accounts: PortfolioAccount[]) {
  const headers = [
    "accountLogin",
    "accountName",
    "portfolioCategory",
    "brokerName",
    "terminalName",
    "balance",
    "equity",
    "margin",
    "tradingAllowed",
    "syncStatus",
    "riskLevel",
    "allocationPercent",
    "isActive",
    "isPinned",
    "switchable",
    "lastSyncAt"
  ];
  const rows = accounts.map((account) =>
    headers.map((header) => csvEscape(account[header as keyof PortfolioAccount])).join(",")
  );
  return [headers.join(","), ...rows].join("\n");
}

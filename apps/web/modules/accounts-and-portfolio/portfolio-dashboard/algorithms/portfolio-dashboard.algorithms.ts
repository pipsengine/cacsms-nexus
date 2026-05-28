import type { AccountCenterResponse } from "../../account-center/types/account-center.types";
import type { PortfolioAllocationSlice, PortfolioDashboardResponse, PortfolioPerformanceRow } from "../types/portfolio-dashboard.types";

function toneFromRatio(ratio: number): PortfolioDashboardResponse["kpis"][number]["status"] {
  if (ratio >= 0.75) return "Healthy";
  if (ratio >= 0.5) return "Watch";
  if (ratio >= 0.25) return "Degraded";
  return "Critical";
}

export function buildAllocationSlices(accounts: AccountCenterResponse["accounts"]): PortfolioAllocationSlice[] {
  const totalEquity = accounts.reduce((sum, account) => sum + account.equity, 0);
  return accounts
    .map((account) => ({
      accountId: account.id,
      accountLogin: account.accountLogin,
      accountName: account.accountName,
      portfolioCategory: account.portfolioCategory,
      allocationPercent: account.allocationPercent,
      equity: account.equity,
      equitySharePercent: totalEquity > 0 ? Number(((account.equity / totalEquity) * 100).toFixed(1)) : 0,
      tradingAllowed: account.tradingAllowed,
      isActive: account.isActive
    }))
    .sort((left, right) => right.equitySharePercent - left.equitySharePercent);
}

export function buildPerformanceRows(accounts: AccountCenterResponse["accounts"]): PortfolioPerformanceRow[] {
  return accounts
    .map((account) => ({
      accountId: account.id,
      accountLogin: account.accountLogin,
      brokerName: account.brokerName,
      dailyProfitLoss: account.dailyProfitLoss,
      monthlyProfitLoss: account.monthlyProfitLoss,
      floatingProfitLoss: account.floatingProfitLoss,
      equity: account.equity,
      syncStatus: account.syncStatus
    }))
    .sort((left, right) => right.equity - left.equity);
}

export function buildPortfolioDashboardKpis(source: AccountCenterResponse) {
  const accounts = source.accounts;
  const totalEquity = accounts.reduce((sum, account) => sum + account.equity, 0);
  const totalBalance = accounts.reduce((sum, account) => sum + account.balance, 0);
  const allocated = accounts.reduce((sum, account) => sum + account.allocationPercent, 0);
  const tradingEnabled = accounts.filter((account) => account.tradingAllowed).length;
  const now = source.meta.timestamp;

  return [
    { label: "Portfolio Accounts", value: String(accounts.length), status: accounts.length ? "Healthy" : "Watch", detail: "Linked accounts in workspace inventory", updatedAt: now },
    { label: "Aggregate Equity", value: `$${totalEquity.toLocaleString()}`, status: "Healthy", detail: "Combined equity across accounts", updatedAt: now },
    { label: "Aggregate Balance", value: `$${totalBalance.toLocaleString()}`, status: "Healthy", detail: "Combined balance across accounts", updatedAt: now },
    { label: "Allocation Coverage", value: `${allocated.toFixed(1)}%`, status: toneFromRatio(allocated / 100), detail: "Configured allocation percentages", updatedAt: now },
    { label: "Trading Enabled", value: String(tradingEnabled), status: tradingEnabled ? "Healthy" : "Watch", detail: "Accounts permitted to route orders", updatedAt: now },
    { label: "Portfolio Health", value: source.kpis.find((kpi) => kpi.label === "Portfolio Health")?.value ?? "0/100", status: source.kpis.find((kpi) => kpi.label === "Portfolio Health")?.status ?? "Watch", detail: "Derived from account center reliability posture", updatedAt: now }
  ] satisfies PortfolioDashboardResponse["kpis"];
}

export function buildPortfolioQuickLinks(activeAccountId: string | null) {
  const accountCenterHref = activeAccountId
    ? `/accounts-and-portfolio/account-center?accountId=${encodeURIComponent(activeAccountId)}`
    : "/accounts-and-portfolio/account-center";
  return [
    {
      label: "Account Center",
      href: accountCenterHref,
      description: "All linked accounts, workspace switching, and category filters."
    },
    {
      label: "MT5 Account Sync",
      href: "/mt5-infrastructure-and-broker-connectivity/account-sync",
      description: "Live MT5 synchronization and reconciliation controls."
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

export function mapAccountCenterToPortfolioDashboard(
  source: AccountCenterResponse,
  highlightedAccountId: string | null
): PortfolioDashboardResponse {
  return {
    meta: {
      timestamp: source.meta.timestamp,
      currentRole: source.meta.currentRole,
      streamEndpoint: "/api/accounts-and-portfolio/portfolio-dashboard/events-stream",
      monitoringMode: "Cross-Account Portfolio Analytics",
      activeAccountId: source.meta.activeAccountId,
      highlightedAccountId
    },
    kpis: buildPortfolioDashboardKpis(source),
    allocations: buildAllocationSlices(source.accounts),
    performance: buildPerformanceRows(source.accounts),
    groups: source.groups,
    accounts: source.accounts,
    activeAccount: source.activeAccount,
    quickLinks: buildPortfolioQuickLinks(source.meta.activeAccountId),
    permissions: {
      role: source.permissions.role,
      canExport: source.permissions.canExport,
      canManageAllocation: source.permissions.canManageAllocation
    }
  };
}

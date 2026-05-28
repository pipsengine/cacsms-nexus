import { calculateExposureRisk } from "@/modules/mt5-infrastructure-and-broker-connectivity/account-sync/algorithms/account-sync.algorithms";
import type { AccountExposure, AccountTone, SyncedAccount } from "@/modules/mt5-infrastructure-and-broker-connectivity/account-sync/types/account-sync.types";
import type { AccountCenterResponse } from "../../account-center/types/account-center.types";
import type {
  RiskAccountSnapshot,
  RiskAndExposureResponse,
  RiskLevel,
  RiskWarning,
  RiskWorkflowNode,
  SymbolExposureRow
} from "../types/risk-and-exposure.types";

function toneFromRiskLevel(level: RiskLevel): RiskAndExposureResponse["kpis"][number]["status"] {
  if (level === "Low") return "Healthy";
  if (level === "Moderate") return "Watch";
  if (level === "Elevated") return "Degraded";
  return "Critical";
}

export function parseLeverageRatio(leverage: string) {
  const match = leverage.match(/(\d+)\s*:\s*(\d+)/i);
  if (!match) return 0;
  const left = Number(match[1]);
  const right = Number(match[2]);
  if (!left || !right) return 0;
  return Math.max(left, right) / Math.min(left, right);
}

export function buildRiskAccountSnapshots(
  source: AccountCenterResponse,
  synced: SyncedAccount[],
  exposures: AccountExposure[]
): RiskAccountSnapshot[] {
  const syncedById = new Map(synced.map((account) => [account.id, account]));

  return source.accounts.map((portfolio) => {
    const sync = syncedById.get(portfolio.id) ?? synced.find((item) => item.accountLogin === portfolio.accountLogin);
    const marginUtilization = portfolio.equity ? Math.round((portfolio.margin / portfolio.equity) * 100) : 100;
    const exposure = sync
      ? calculateExposureRisk(sync, exposures)
      : {
          accountId: portfolio.id,
          totalExposure: exposures.filter((row) => row.accountId === portfolio.id).reduce((sum, row) => sum + Math.abs(row.notionalExposure), 0),
          marginUtilization,
          floatingDrawdown: portfolio.balance ? Math.round((Math.max(0, -portfolio.floatingProfitLoss) / portfolio.balance) * 100) : 0,
          concentrationRisk: 0,
          correlatedExposureWarning: false,
          longExposure: 0,
          shortExposure: 0,
          riskScore: marginUtilization,
          riskLevel: (portfolio.riskLevel === "Critical" ? "Critical" : marginUtilization > 75 ? "High" : marginUtilization > 50 ? "Elevated" : "Moderate") as RiskLevel,
          emergencyRiskFlag: portfolio.riskLevel === "Critical" || marginUtilization >= 90
        };

    return {
      accountId: portfolio.id,
      accountLogin: portfolio.accountLogin,
      accountName: portfolio.accountName,
      brokerName: portfolio.brokerName,
      portfolioCategory: portfolio.portfolioCategory,
      leverage: portfolio.leverage,
      leverageRatio: parseLeverageRatio(portfolio.leverage),
      balance: portfolio.balance,
      equity: portfolio.equity,
      margin: portfolio.margin,
      freeMargin: portfolio.freeMargin,
      marginLevel: portfolio.marginLevel,
      marginUtilization: exposure.marginUtilization,
      floatingProfitLoss: portfolio.floatingProfitLoss,
      openPositionsCount: portfolio.openPositionsCount,
      exposure,
      syncStatus: portfolio.syncStatus,
      tradingAllowed: portfolio.tradingAllowed,
      isActive: portfolio.isActive,
      blockReason: portfolio.switchBlockReason
    };
  });
}

export function buildSymbolExposureRows(exposures: AccountExposure[]): SymbolExposureRow[] {
  return exposures
    .map((row) => ({
      id: row.id,
      accountId: row.accountId,
      accountLogin: row.accountLogin,
      symbol: row.normalizedSymbol,
      assetClass: row.assetClass,
      correlationGroup: row.correlationGroup,
      netVolume: row.netVolume,
      notionalExposure: row.notionalExposure,
      marginUsed: row.marginUsed,
      floatingProfitLoss: row.floatingProfitLoss,
      exposureRiskScore: row.exposureRiskScore,
      measuredAt: row.measuredAt
    }))
    .sort((left, right) => right.notionalExposure - left.notionalExposure);
}

export function buildRiskWarnings(accounts: RiskAccountSnapshot[]): RiskWarning[] {
  const warnings: RiskWarning[] = [];

  for (const account of accounts) {
    if (account.exposure.emergencyRiskFlag) {
      warnings.push({
        id: `warn-emergency-${account.accountId}`,
        severity: "Critical",
        accountLogin: account.accountLogin,
        title: "Emergency risk flag",
        detail: `${account.accountLogin} exceeds critical exposure thresholds. Review margin and correlated exposure immediately.`
      });
    }
    if (account.exposure.correlatedExposureWarning) {
      warnings.push({
        id: `warn-correlation-${account.accountId}`,
        severity: "Degraded",
        accountLogin: account.accountLogin,
        title: "Correlated exposure concentration",
        detail: `${account.accountLogin} has more than 65% exposure concentrated in one correlation group.`
      });
    }
    if (account.marginLevel > 0 && account.marginLevel < 150) {
      warnings.push({
        id: `warn-margin-${account.accountId}`,
        severity: account.marginLevel < 100 ? "Critical" : "Watch",
        accountLogin: account.accountLogin,
        title: "Low margin level",
        detail: `${account.accountLogin} margin level is ${account.marginLevel.toFixed(1)}%.`
      });
    }
    if (account.leverageRatio >= 200) {
      warnings.push({
        id: `warn-leverage-${account.accountId}`,
        severity: "Watch",
        accountLogin: account.accountLogin,
        title: "High leverage profile",
        detail: `${account.accountLogin} runs at ${account.leverage} leverage.`
      });
    }
    if (!account.tradingAllowed && account.blockReason) {
      warnings.push({
        id: `warn-trading-${account.accountId}`,
        severity: "Degraded",
        accountLogin: account.accountLogin,
        title: "Trading restricted",
        detail: account.blockReason
      });
    }
  }

  return warnings.slice(0, 12);
}

export function buildRiskWorkflow(accounts: RiskAccountSnapshot[]): RiskWorkflowNode[] {
  const blocked = accounts.filter((account) => account.exposure.emergencyRiskFlag || account.marginLevel < 100).length;
  const step = (title: string, status: AccountTone, blockedCount: number, detail: string): RiskWorkflowNode => ({
    title,
    status,
    accountCount: accounts.length,
    blockedCount,
    detail
  });

  return [
    step("Account Snapshots", accounts.length ? "Healthy" : "Watch", 0, "Margin, equity, and leverage collected from account sync."),
    step("Margin Utilization", accounts.some((a) => a.marginUtilization > 50) ? "Watch" : "Healthy", accounts.filter((a) => a.marginUtilization > 75).length, "Per-account margin usage versus equity."),
    step("Leverage Posture", accounts.some((a) => a.leverageRatio >= 200) ? "Watch" : "Healthy", accounts.filter((a) => a.leverageRatio >= 500).length, "Configured account leverage reviewed across inventory."),
    step("Exposure Aggregation", accounts.some((a) => a.exposure.correlatedExposureWarning) ? "Degraded" : "Healthy", accounts.filter((a) => a.exposure.correlatedExposureWarning).length, "Symbol and correlation-group exposure calculated."),
    step("Risk Thresholds", blocked > 0 ? "Critical" : accounts.some((a) => a.exposure.riskLevel === "High") ? "Degraded" : "Healthy", blocked, "Emergency flags and margin floor checks applied."),
    step("Operator Alerts", accounts.some((a) => !a.tradingAllowed) ? "Degraded" : "Healthy", accounts.filter((a) => !a.tradingAllowed).length, "Trading restrictions and block reasons surfaced for review.")
  ];
}

export function buildRiskKpis(accounts: RiskAccountSnapshot[], timestamp: string) {
  const totalEquity = accounts.reduce((sum, account) => sum + account.equity, 0);
  const totalMargin = accounts.reduce((sum, account) => sum + account.margin, 0);
  const totalExposure = accounts.reduce((sum, account) => sum + account.exposure.totalExposure, 0);
  const avgMarginUtilization = accounts.length
    ? accounts.reduce((sum, account) => sum + account.marginUtilization, 0) / accounts.length
    : 0;
  const criticalCount = accounts.filter((account) => account.exposure.riskLevel === "Critical" || account.exposure.riskLevel === "High").length;
  const emergencyCount = accounts.filter((account) => account.exposure.emergencyRiskFlag).length;
  const avgLeverage = accounts.length ? accounts.reduce((sum, account) => sum + account.leverageRatio, 0) / accounts.length : 0;

  return [
    { label: "Linked Accounts", value: String(accounts.length), status: accounts.length ? "Healthy" : "Watch", detail: "Accounts in risk scope", updatedAt: timestamp },
    { label: "Aggregate Exposure", value: `$${Math.round(totalExposure).toLocaleString()}`, status: totalExposure > totalEquity ? "Degraded" : "Healthy", detail: "Combined notional exposure", updatedAt: timestamp },
    { label: "Aggregate Margin", value: `$${Math.round(totalMargin).toLocaleString()}`, status: "Healthy", detail: "Total margin in use", updatedAt: timestamp },
    { label: "Avg Margin Utilization", value: `${avgMarginUtilization.toFixed(1)}%`, status: avgMarginUtilization > 60 ? "Degraded" : avgMarginUtilization > 40 ? "Watch" : "Healthy", detail: "Average margin vs equity", updatedAt: timestamp },
    { label: "Avg Leverage", value: avgLeverage ? `1:${Math.round(avgLeverage)}` : "N/A", status: avgLeverage >= 200 ? "Watch" : "Healthy", detail: "Mean configured leverage ratio", updatedAt: timestamp },
    { label: "High Risk Accounts", value: String(criticalCount), status: criticalCount ? "Critical" : "Healthy", detail: "Accounts at High or Critical risk", updatedAt: timestamp },
    { label: "Emergency Flags", value: String(emergencyCount), status: emergencyCount ? "Critical" : "Healthy", detail: "Accounts exceeding emergency thresholds", updatedAt: timestamp }
  ] satisfies RiskAndExposureResponse["kpis"];
}

export function buildRiskQuickLinks(activeAccountId: string | null) {
  const accountHref = activeAccountId
    ? `/accounts-and-portfolio/account-center?accountId=${encodeURIComponent(activeAccountId)}`
    : "/accounts-and-portfolio/account-center";
  const portfolioHref = activeAccountId
    ? `/accounts-and-portfolio/portfolio-dashboard?accountId=${encodeURIComponent(activeAccountId)}`
    : "/accounts-and-portfolio/portfolio-dashboard";
  return [
    { label: "Account Center", href: accountHref, description: "Account inventory, switching, and workspace controls." },
    { label: "Portfolio Dashboard", href: portfolioHref, description: "Cross-account equity and allocation analytics." },
    { label: "Account Sync", href: "/mt5-infrastructure-and-broker-connectivity/account-sync", description: "Live sync, reconciliation, and trading permissions." },
    { label: "Account History", href: "/accounts-and-portfolio/account-history", description: "Funding and workspace change timeline (planned)." }
  ];
}

export function mapToRiskAndExposureResponse(input: {
  source: AccountCenterResponse;
  synced: SyncedAccount[];
  exposures: AccountExposure[];
  highlightedAccountId: string | null;
}): RiskAndExposureResponse {
  const accounts = buildRiskAccountSnapshots(input.source, input.synced, input.exposures);
  const symbolExposures = buildSymbolExposureRows(input.exposures);
  const warnings = buildRiskWarnings(accounts);
  const timestamp = input.source.meta.timestamp;

  return {
    meta: {
      timestamp,
      currentRole: input.source.meta.currentRole,
      streamEndpoint: "/api/accounts-and-portfolio/risk-and-exposure/events-stream",
      monitoringMode: "Cross-Account Risk & Exposure Monitor",
      activeAccountId: input.source.meta.activeAccountId,
      highlightedAccountId: input.highlightedAccountId
    },
    kpis: buildRiskKpis(accounts, timestamp),
    workflow: buildRiskWorkflow(accounts),
    accounts,
    symbolExposures,
    warnings,
    quickLinks: buildRiskQuickLinks(input.source.meta.activeAccountId),
    permissions: {
      role: input.source.permissions.role,
      canExport: input.source.permissions.canExport,
      canManageRisk: ["Super Admin", "Infrastructure Admin", "Risk Manager"].includes(input.source.permissions.role)
    }
  };
}

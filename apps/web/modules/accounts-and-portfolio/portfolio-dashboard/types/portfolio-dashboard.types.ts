import type { AccountTone, Mt5Role } from "@/modules/mt5-infrastructure-and-broker-connectivity/mt5-control-center/types/mt5-control-center.types";
import type { AccountCenterGroupSummary, PortfolioAccount, PortfolioCategory } from "../../account-center/types/account-center.types";

export type PortfolioAllocationSlice = {
  accountId: string;
  accountLogin: string;
  accountName: string;
  portfolioCategory: PortfolioCategory;
  allocationPercent: number;
  equity: number;
  equitySharePercent: number;
  tradingAllowed: boolean;
  isActive: boolean;
};

export type PortfolioPerformanceRow = {
  accountId: string;
  accountLogin: string;
  brokerName: string;
  dailyProfitLoss: number;
  monthlyProfitLoss: number;
  floatingProfitLoss: number;
  equity: number;
  syncStatus: AccountTone;
};

export type PortfolioDashboardResponse = {
  meta: {
    timestamp: string;
    currentRole: Mt5Role;
    streamEndpoint: string;
    monitoringMode: string;
    activeAccountId: string | null;
    highlightedAccountId: string | null;
  };
  kpis: Array<{ label: string; value: string; status: AccountTone; detail: string; updatedAt: string }>;
  allocations: PortfolioAllocationSlice[];
  performance: PortfolioPerformanceRow[];
  groups: AccountCenterGroupSummary[];
  accounts: PortfolioAccount[];
  activeAccount: PortfolioAccount | null;
  quickLinks: Array<{ label: string; href: string; description: string }>;
  permissions: {
    role: Mt5Role;
    canExport: boolean;
    canManageAllocation: boolean;
  };
};

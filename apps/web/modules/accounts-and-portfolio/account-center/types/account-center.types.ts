import type { AuditRecord, Mt5Role } from "@/modules/mt5-infrastructure-and-broker-connectivity/mt5-control-center/types/mt5-control-center.types";
import type { AccountTone } from "@/modules/mt5-infrastructure-and-broker-connectivity/account-sync/types/account-sync.types";

export type PortfolioCategory = "Live" | "Demo" | "Prop Firm" | "Broker" | "Paper" | "Unknown";
export type AccountCenterRole = Mt5Role;

export type PortfolioAccount = {
  id: string;
  accountId: string;
  accountLogin: string;
  accountName: string;
  brokerId: string;
  brokerName: string;
  terminalId: string;
  terminalName: string;
  serverName: string;
  accountType: string;
  portfolioCategory: PortfolioCategory;
  currency: string;
  leverage: string;
  balance: number;
  equity: number;
  margin: number;
  freeMargin: number;
  marginLevel: number;
  floatingProfitLoss: number;
  dailyProfitLoss: number;
  monthlyProfitLoss: number;
  tradingAllowed: boolean;
  expertTradingAllowed: boolean;
  syncStatus: AccountTone;
  riskLevel: AccountTone;
  syncReliabilityScore: number;
  syncDelaySeconds: number;
  openPositionsCount: number;
  pendingOrdersCount: number;
  eaBridgeLinked: boolean;
  lastSyncAt: string;
  isActive: boolean;
  isPinned: boolean;
  allocationPercent: number;
  switchable: boolean;
  switchBlockReason?: string;
  tags: string[];
};

export type AccountSwitchEvent = {
  id: string;
  accountId: string;
  accountLogin: string;
  accountName: string;
  brokerName: string;
  portfolioCategory: PortfolioCategory;
  switchedAt: string;
  switchedBy: string;
  reason: string;
  previousAccountId: string | null;
};

export type AccountCenterWorkflowNode = {
  title: string;
  status: AccountTone;
  accountCount: number;
  blockedCount: number;
  detail: string;
};

export type AccountCenterGroupSummary = {
  category: PortfolioCategory | "All";
  count: number;
  totalEquity: number;
  tradingEnabledCount: number;
  healthyCount: number;
};

export type AccountCenterResponse = {
  meta: {
    timestamp: string;
    currentRole: AccountCenterRole;
    streamEndpoint: string;
    monitoringMode: string;
    activeAccountId: string | null;
  };
  kpis: Array<{ label: string; value: string; status: AccountTone; detail: string; updatedAt: string }>;
  workflow: AccountCenterWorkflowNode[];
  accounts: PortfolioAccount[];
  groups: AccountCenterGroupSummary[];
  activeAccount: PortfolioAccount | null;
  switchHistory: AccountSwitchEvent[];
  quickLinks: Array<{ label: string; href: string; description: string }>;
  permissions: {
    role: AccountCenterRole;
    canSwitch: boolean;
    canPin: boolean;
    canExport: boolean;
    canManageAllocation: boolean;
  };
  audits: AuditRecord[];
};

export type AccountCenterSummaryResponse = Pick<AccountCenterResponse, "meta" | "kpis" | "groups" | "activeAccount" | "permissions">;

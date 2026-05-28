import type { AccountTone, Mt5Role } from "@/modules/mt5-infrastructure-and-broker-connectivity/mt5-control-center/types/mt5-control-center.types";
import type { ExposureSummary } from "@/modules/mt5-infrastructure-and-broker-connectivity/account-sync/types/account-sync.types";

export type RiskLevel = ExposureSummary["riskLevel"];

export type RiskAccountSnapshot = {
  accountId: string;
  accountLogin: string;
  accountName: string;
  brokerName: string;
  portfolioCategory: string;
  leverage: string;
  leverageRatio: number;
  balance: number;
  equity: number;
  margin: number;
  freeMargin: number;
  marginLevel: number;
  marginUtilization: number;
  floatingProfitLoss: number;
  openPositionsCount: number;
  exposure: ExposureSummary;
  syncStatus: AccountTone;
  tradingAllowed: boolean;
  isActive: boolean;
  blockReason?: string;
};

export type SymbolExposureRow = {
  id: string;
  accountId: string;
  accountLogin: string;
  symbol: string;
  assetClass: string;
  correlationGroup: string;
  netVolume: number;
  notionalExposure: number;
  marginUsed: number;
  floatingProfitLoss: number;
  exposureRiskScore: number;
  measuredAt: string;
};

export type RiskWarning = {
  id: string;
  severity: AccountTone;
  accountLogin: string;
  title: string;
  detail: string;
};

export type RiskWorkflowNode = {
  title: string;
  status: AccountTone;
  accountCount: number;
  blockedCount: number;
  detail: string;
};

export type RiskAndExposureResponse = {
  meta: {
    timestamp: string;
    currentRole: Mt5Role;
    streamEndpoint: string;
    monitoringMode: string;
    activeAccountId: string | null;
    highlightedAccountId: string | null;
  };
  kpis: Array<{ label: string; value: string; status: AccountTone; detail: string; updatedAt: string }>;
  workflow: RiskWorkflowNode[];
  accounts: RiskAccountSnapshot[];
  symbolExposures: SymbolExposureRow[];
  warnings: RiskWarning[];
  quickLinks: Array<{ label: string; href: string; description: string }>;
  permissions: {
    role: Mt5Role;
    canExport: boolean;
    canManageRisk: boolean;
  };
};

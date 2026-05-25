import type { AuditRecord, Mt5Role } from "../../mt5-control-center/types/mt5-control-center.types";

export type MarketTone = "Healthy" | "Watch" | "Degraded" | "Critical" | "Offline" | "Inactive";
export type MarketSeverity = "Info" | "Warning" | "Critical";

export type MarketInstrument = {
  id: string;
  symbol: string;
  description: string;
  assetClass: "Forex" | "Metal" | "Index" | "Energy" | "Crypto";
  brokerName: string;
  bid: number;
  ask: number;
  digits: number;
  point: number;
  dailyOpen: number;
  dailyHigh: number;
  dailyLow: number;
  volume: number;
  volatilityPercent: number;
  spreadBaselinePoints: number;
  latencyMs: number;
  session: string;
  marketOpen: boolean;
  lastTickAt: string;
  feedActive: boolean;
  watchlisted: boolean;
  tradeEnabled: boolean;
  trend: number[];
};

export type MarketAlert = {
  id: string;
  instrumentId: string;
  symbol: string;
  alertType: "Stale Quote" | "Spread Expansion" | "Volatility Surge" | "Feed Offline" | "Trading Restricted";
  severity: MarketSeverity;
  detail: string;
  recommendation: string;
  detectedAt: string;
};

export type MarketSession = {
  name: string;
  status: MarketTone;
  opensAt: string;
  closesAt: string;
  instrumentsLive: number;
  liquidityScore: number;
  note: string;
};

export type MarketDiagnostic = {
  id: string;
  instrumentId: string;
  issue: string;
  severity: MarketSeverity;
  rootCause: string;
  tradingImpact: string;
  recommendation: string;
  confidenceScore: number;
  autoFixEligible: boolean;
  createdAt: string;
};

export type MarketHealth = {
  score: number;
  rating: "Excellent" | "Healthy" | "Degraded" | "High Risk" | "Critical";
  factors: Record<string, number>;
};

export type MarketWatchResponse = {
  meta: { timestamp: string; currentRole: Mt5Role; streamEndpoint: string; monitoringMode: "Autonomous Quote Surveillance" };
  kpis: Array<{ label: string; value: string; status: MarketTone; detail: string }>;
  instruments: MarketInstrument[];
  alerts: MarketAlert[];
  diagnostics: MarketDiagnostic[];
  sessions: MarketSession[];
  health: MarketHealth;
  movers: MarketInstrument[];
  audits: AuditRecord[];
  permissions: {
    role: Mt5Role;
    canRefresh: boolean;
    canManageWatchlist: boolean;
    canDiagnostics: boolean;
    canRemediate: boolean;
  };
};

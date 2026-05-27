import type { AuditRecord, Mt5Role } from "../../mt5-control-center/types/mt5-control-center.types";

export type ChartTone = "Healthy" | "Watch" | "Degraded" | "Critical" | "Offline" | "Inactive";
export type ChartSeverity = "Info" | "Warning" | "Critical";
export type Timeframe = "M1" | "M5" | "M15" | "H1" | "H4" | "D1";

export const timeframes: Timeframe[] = ["M1", "M5", "M15", "H1", "H4", "D1"];

export type Candle = {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  sma20: number;
  ema9: number;
  rsi: number;
};

export type ChartInstrument = {
  id: string;
  symbol: string;
  description: string;
  assetClass: string;
  brokerName: string;
  digits: number;
  timeframe: Timeframe;
  availableTimeframes: Timeframe[];
  bid: number;
  ask: number;
  spreadPoints: number;
  lastTickAt: string;
  feedStatus: ChartTone;
  tradeEnabled: boolean;
  candles: Candle[];
  visibleIndicators: string[];
};

export type ChartLayout = {
  id: string;
  name: string;
  slots: number;
  instruments: string[];
  timeframes: Timeframe[];
  indicators: string[];
  active: boolean;
  updatedAt: string;
};

export type DrawingObject = {
  id: string;
  instrumentId: string;
  label: string;
  kind: "Trendline" | "Horizontal Level" | "Risk Zone" | "Fibonacci";
  price: number;
  color: string;
  visible: boolean;
};

export type ChartSignal = {
  id: string;
  instrumentId: string;
  symbol: string;
  signalType: "Trend Shift" | "Breakout" | "Momentum Divergence" | "Volatility Expansion" | "Data Quality";
  direction: "Bullish" | "Bearish" | "Neutral";
  severity: ChartSeverity;
  timeframe: Timeframe;
  detail: string;
  confidenceScore: number;
  detectedAt: string;
};

export type ChartSnapshot = {
  id: string;
  symbol: string;
  timeframe: Timeframe;
  layoutName: string;
  capturedBy: string;
  capturedAt: string;
  note: string;
};

export type ChartAnalysis = {
  trend: "Bullish" | "Bearish" | "Range";
  changePercent: number;
  rsi: number;
  support: number;
  resistance: number;
  averageVolume: number;
  volatilityPercent: number;
  status: ChartTone;
};

export type ChartControlResponse = {
  meta: { timestamp: string; currentRole: Mt5Role; streamEndpoint: string; monitoringMode: "Autonomous Chart Surveillance" };
  kpis: Array<{ label: string; value: string; status: ChartTone; detail: string }>;
  instruments: ChartInstrument[];
  layouts: ChartLayout[];
  drawings: DrawingObject[];
  signals: ChartSignal[];
  snapshots: ChartSnapshot[];
  analysisByInstrument: Record<string, ChartAnalysis>;
  audits: AuditRecord[];
  permissions: {
    role: Mt5Role;
    canRefresh: boolean;
    canConfigure: boolean;
    canSnapshot: boolean;
    canPublish: boolean;
  };
};

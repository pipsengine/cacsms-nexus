import type { ExecutiveDashboardResponse } from "../types/executive-dashboard.types";

export type ExecutiveDashboardCharts = {
  aiConfidenceTrend: Array<{ time: string; confidence: number }>;
  riskPressureBreakdown: Array<{ key: string; value: number }>;
};

export function mapExecutiveDashboardCharts(data: ExecutiveDashboardResponse): ExecutiveDashboardCharts {
  const aiConfidenceTrend = [...data.recentDecisions]
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .map((decision) => ({
      time: new Date(decision.timestamp).toLocaleTimeString(),
      confidence: decision.confidence
    }));

  const riskPressureBreakdown = Object.entries(data.summary.riskPressureScore.factors).map(([key, value]) => ({
    key,
    value
  }));

  return { aiConfidenceTrend, riskPressureBreakdown };
}

export function formatCurrency(value: number) {
  return value.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export function formatNumber(value: number, maximumFractionDigits = 0) {
  return value.toLocaleString(undefined, { maximumFractionDigits });
}

export function formatPercent(value: number, maximumFractionDigits = 0) {
  return `${value.toFixed(maximumFractionDigits)}%`;
}


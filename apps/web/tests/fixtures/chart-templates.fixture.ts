import type { ChartTemplate, TemplateDeployment } from "@/modules/mt5-infrastructure-and-broker-connectivity/chart-templates/types/chart-templates.types";

const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

export function createChartTemplatesSeed() {
  const templates: ChartTemplate[] = [
    {
      id: "template-execution", name: "Execution Workspace Core", description: "Four-panel execution context for FX, metals, and index routing.", category: "Execution", version: "v3.2", status: "Published", owner: "Trading Admin", visibility: "Institution", slots: 4,
      symbols: ["EURUSD", "XAUUSD", "NAS100", "GBPUSD"], timeframes: ["M15", "H1", "M15", "H1"],
      indicators: [{ name: "EMA", parameters: "9 close", pane: "Overlay", color: "#10b981", required: true }, { name: "SMA", parameters: "20 close", pane: "Overlay", color: "#7c3aed", required: true }, { name: "RSI", parameters: "14", pane: "Oscillator", color: "#2563eb", required: true }, { name: "Volume", parameters: "tick", pane: "Volume", color: "#64748b", required: false }],
      drawingTools: ["Horizontal Level", "Trendline", "Risk Zone"], colorTheme: "Institutional Light", candleStyle: "Candles", riskOverlays: ["Spread Guard", "Execution Block Zone"], alertRules: ["Stale quote > 15s", "Spread > 2x baseline"], usageCount: 146, activeDeployments: 3, lastValidatedAt: ago(7), updatedAt: ago(18), validationStatus: "Healthy"
    },
    {
      id: "template-liquidity", name: "Intraday Liquidity Scan", description: "Fast-moving session and spread analysis for short-horizon entries.", category: "Scalping", version: "v1.8", status: "Published", owner: "Market Analyst", visibility: "Team", slots: 2,
      symbols: ["EURUSD", "XAUUSD"], timeframes: ["M5", "M5"],
      indicators: [{ name: "VWAP", parameters: "session", pane: "Overlay", color: "#2563eb", required: true }, { name: "EMA", parameters: "9 close", pane: "Overlay", color: "#10b981", required: true }, { name: "Volume", parameters: "tick", pane: "Volume", color: "#64748b", required: true }],
      drawingTools: ["Session Range", "Liquidity Zone"], colorTheme: "Midnight", candleStyle: "Candles", riskOverlays: ["Spread Guard"], alertRules: ["Spread > 1.5x baseline"], usageCount: 88, activeDeployments: 2, lastValidatedAt: ago(45), updatedAt: ago(52), validationStatus: "Healthy"
    },
    {
      id: "template-risk", name: "Risk Escalation Review", description: "Review layout for anomalous feeds, volatility, and blocked execution.", category: "Risk", version: "v2.0-rc1", status: "In Review", owner: "Risk Manager", visibility: "Team", slots: 3,
      symbols: ["NAS100", "XAUUSD", "GBPUSD"], timeframes: ["H1", "H4", "H1"],
      indicators: [{ name: "ATR", parameters: "14", pane: "Oscillator", color: "#dc2626", required: true }, { name: "RSI", parameters: "14", pane: "Oscillator", color: "#7c3aed", required: true }],
      drawingTools: ["Risk Zone", "Horizontal Level"], colorTheme: "Risk Contrast", candleStyle: "Bars", riskOverlays: ["Execution Block Zone", "News Window"], alertRules: ["Offline feed", "ATR > risk threshold"], usageCount: 21, activeDeployments: 1, lastValidatedAt: ago(1680), updatedAt: ago(64), validationStatus: "Degraded"
    },
    {
      id: "template-swing", name: "Macro Swing Structure", description: "Daily directional template for macro confirmation and position holds.", category: "Swing", version: "v0.6", status: "Draft", owner: "Analyst", visibility: "Private", slots: 2,
      symbols: ["EURUSD", "UKOIL"], timeframes: ["H4", "D1"],
      indicators: [{ name: "SMA", parameters: "50 close", pane: "Overlay", color: "#7c3aed", required: true }],
      drawingTools: ["Fibonacci", "Trendline"], colorTheme: "Institutional Light", candleStyle: "Candles", riskOverlays: [], alertRules: [], usageCount: 0, activeDeployments: 0, lastValidatedAt: ago(4320), updatedAt: ago(90), validationStatus: "Critical"
    },
    {
      id: "template-archive", name: "Legacy Momentum Stack", description: "Retired preset retained for audit comparison.", category: "Analysis", version: "v1.1", status: "Archived", owner: "Infrastructure Admin", visibility: "Team", slots: 1,
      symbols: ["EURUSD"], timeframes: ["M15"], indicators: [{ name: "MACD", parameters: "12,26,9", pane: "Oscillator", color: "#2563eb", required: false }],
      drawingTools: [], colorTheme: "Classic", candleStyle: "Candles", riskOverlays: [], alertRules: [], usageCount: 42, activeDeployments: 0, lastValidatedAt: ago(11000), updatedAt: ago(10800), validationStatus: "Inactive"
    }
  ];
  const deployments: TemplateDeployment[] = [
    { id: "deploy-1", templateId: "template-execution", templateName: "Execution Workspace Core", workspace: "London Execution Desk", assignedTo: "trading-admin", environment: "Live", status: "Healthy", deployedAt: ago(4120), lastUsedAt: ago(3) },
    { id: "deploy-2", templateId: "template-execution", templateName: "Execution Workspace Core", workspace: "Autonomous Router Review", assignedTo: "ai-monitor", environment: "Simulation", status: "Healthy", deployedAt: ago(2080), lastUsedAt: ago(12) },
    { id: "deploy-3", templateId: "template-liquidity", templateName: "Intraday Liquidity Scan", workspace: "Market Watch Desk", assignedTo: "analyst", environment: "Live", status: "Healthy", deployedAt: ago(870), lastUsedAt: ago(1) },
    { id: "deploy-4", templateId: "template-risk", templateName: "Risk Escalation Review", workspace: "Feed Exception Review", assignedTo: "risk-manager", environment: "Review", status: "Degraded", deployedAt: ago(73), lastUsedAt: ago(16) }
  ];
  return { templates, deployments };
}

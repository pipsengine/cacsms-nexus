import {describe, expect, it, beforeEach } from "vitest";
import { seedChartControlStore } from "@/tests/helpers/seed-api-stores";
import { applyLayout, audits, buildChartControlResponse, captureSnapshot, changeTimeframe, chartRole, refreshCharts, resetChartControlState, toggleIndicator } from "@/app/api/mt5/chart-control/_lib/store";

describe("Chart Control operational controls", () => {
  beforeEach(() => seedChartControlStore());
  it("returns chart workspace panels, analysis, signals, and snapshots", () => {
    const response = buildChartControlResponse("Infrastructure Admin");
    expect(response.kpis).toHaveLength(8);
    expect(response.instruments).toHaveLength(4);
    expect(response.layouts.some((layout) => layout.active)).toBe(true);
    expect(response.analysisByInstrument["chart-nas100"].status).toBe("Offline");
    expect(response.signals.length).toBeGreaterThan(0);
  });

  it("handles an empty workspace without throwing", () => {
    resetChartControlState();
    const response = buildChartControlResponse("Infrastructure Admin");
    expect(response.kpis.find((kpi) => kpi.label === "Active Layout")?.value).toBe("None");
    expect(response.instruments).toEqual([]);
    expect(response.layouts).toEqual([]);
  });

  it("enforces role permissions and operator confirmation", () => {
    expect(chartRole(new Request("http://localhost/api/mt5/chart-control"))).toBe("Read-Only Viewer");
    expect(() => refreshCharts("Read-Only Viewer", true)).toThrow(/not authorized/);
    expect(() => changeTimeframe("chart-eurusd", "H1", "Analyst", false)).toThrow(/Confirmation/);
    expect(() => captureSnapshot("chart-eurusd", "review", "Read-Only Viewer", true)).toThrow(/not authorized/);
  });

  it("updates chart configuration and audits workspace operations", () => {
    const before = audits().length;
    expect(changeTimeframe("chart-eurusd", "H1", "Analyst", true).timeframe).toBe("H1");
    expect(toggleIndicator("chart-eurusd", "VWAP", "Analyst", true).visibleIndicators).toContain("VWAP");
    expect(applyLayout("layout-risk", "Risk Manager", true).active).toBe(true);
    expect(captureSnapshot("chart-eurusd", "Trend confirmed", "Risk Manager", true).note).toBe("Trend confirmed");
    expect(audits().length).toBeGreaterThan(before);
  });
});

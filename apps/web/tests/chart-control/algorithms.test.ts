import { describe, expect, it } from "vitest";
import { analyzeChart, calculateWorkspaceHealth, chartStatus, indicatorRecommendation, visibleCandles } from "@/modules/mt5-infrastructure-and-broker-connectivity/chart-control/algorithms/chart-control.algorithms";
import { createChartControlSeed } from "@/tests/fixtures/chart-control.fixture";

describe("chart-control algorithms", () => {
  it("changes candle windows according to selected timeframe", () => {
    const instrument = createChartControlSeed().instruments[0];
    expect(visibleCandles(instrument.candles, "M1")).toHaveLength(8);
    expect(visibleCandles(instrument.candles, "D1")).toHaveLength(24);
  });

  it("builds technical structure and identifies offline charts", () => {
    const instruments = createChartControlSeed().instruments;
    const gold = analyzeChart(instruments[1]);
    const nasdaq = instruments[2];
    expect(gold.trend).toBe("Bullish");
    expect(gold.resistance).toBeGreaterThan(gold.support);
    expect(chartStatus(nasdaq)).toBe("Offline");
    expect(indicatorRecommendation(analyzeChart(nasdaq))).toMatch(/Freeze trading overlays/);
  });

  it("reduces workspace health when chart feeds are not execution-ready", () => {
    const health = calculateWorkspaceHealth(createChartControlSeed().instruments);
    expect(health.score).toBeLessThan(100);
    expect(health.status).toBe("Degraded");
  });
});

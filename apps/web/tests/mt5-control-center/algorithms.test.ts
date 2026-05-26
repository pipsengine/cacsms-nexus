import { describe, expect, it } from "vitest";

import {
  calculateConnectionHealthScore,
  calculateExecutionQuality,
  detectMarketDataGaps,
  normalizeSymbol,
  recommendRecovery
} from "@/modules/mt5-infrastructure-and-broker-connectivity/mt5-control-center/algorithms/mt5-control-center.algorithms";
import { createMt5Seed } from "@/tests/fixtures/mt5-control-center.fixture";

describe("MT5 monitoring algorithms", () => {
  it("scores degraded connectivity and labels risk consistently", () => {
    const result = calculateConnectionHealthScore({
      uptimePercent: 94,
      heartbeatAgeSeconds: 80,
      latencyMs: 490,
      dataFeedQuality: 60,
      loginSuccessPercent: 60,
      executionSuccessPercent: 70,
      criticalIncidents: 2
    });
    expect(result.score).toBeLessThan(60);
    expect(["High Risk", "Critical"]).toContain(result.rating);
  });

  it("normalizes broker suffix variants into internal symbols", () => {
    expect(normalizeSymbol("EURUSDm").normalizedSymbol).toBe("EURUSD");
    expect(normalizeSymbol("EURUSD.pro").normalizedSymbol).toBe("EURUSD");
    expect(normalizeSymbol("EURUSD_raw").normalizedSymbol).toBe("EURUSD");
    expect(normalizeSymbol("NASDAQ_ecn").normalizedSymbol).toBe("NAS100");
  });

  it("detects feed delays and calculates poor fills", () => {
    const seed = createMt5Seed();
    const gaps = detectMarketDataGaps(seed.symbols);
    const quality = calculateExecutionQuality(seed.executionSamples);
    expect(gaps.missingTicks).toContain("NAS100");
    expect(gaps.delayedTicks).toContain("NAS100");
    expect(quality.rejectionRate).toBe(25);
    expect(quality.fillQualityScore).toBeLessThan(70);
  });

  it("generates a governed offline recovery sequence", () => {
    const offline = { ...createMt5Seed().terminals[2], status: "Offline" as const };
    expect(recommendRecovery(offline)).toContain("Restart MT5 terminal");
    expect(recommendRecovery(offline)).toContain("Disable trading if critical persists");
  });
});

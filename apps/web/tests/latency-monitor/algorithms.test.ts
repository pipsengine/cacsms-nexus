import { describe, expect, it } from "vitest";

import { breachStatusFromThreshold, brokerLatencyRanking, percentile } from "@/modules/mt5-infrastructure-and-broker-connectivity/latency-monitor/algorithms/latency-monitor.algorithms";
import type { LatencyBrokerComparisonRow, LatencyThreshold } from "@/modules/mt5-infrastructure-and-broker-connectivity/latency-monitor/types/latency-monitor.types";

const threshold: LatencyThreshold = {
  id: "thr-1",
  componentType: "Broker Server",
  brokerId: null,
  accountType: "All",
  symbol: null,
  assetClass: "All",
  strategyType: "All",
  tradingSession: "All",
  volatilityRegime: "Normal",
  newsImpactLevel: "High",
  normalLatencyLimitMs: 50,
  warningLatencyLimitMs: 120,
  criticalLatencyLimitMs: 240,
  executionBlockLatencyMs: 320,
  scalpingMaxLatencyMs: 140,
  newsMultiplier: 1.5,
  autoDisableEnabled: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

describe("Latency Monitor algorithms", () => {
  it("classifies breach status using thresholds and news multiplier", () => {
    expect(breachStatusFromThreshold(100, threshold, false)).toBe("Normal");
    expect(breachStatusFromThreshold(130, threshold, false)).toBe("Warning");
    expect(breachStatusFromThreshold(260, threshold, false)).toBe("Critical");
    expect(breachStatusFromThreshold(350, threshold, false)).toBe("Blocked");
    expect(breachStatusFromThreshold(175, threshold, true)).toBe("Normal");
    expect(breachStatusFromThreshold(190, threshold, true)).toBe("Warning");
  });

  it("computes percentiles for latency samples", () => {
    const values = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    expect(percentile(values, 50)).toBe(50);
    expect(percentile(values, 95)).toBe(100);
    expect(percentile(values, 99)).toBe(100);
  });

  it("ranks brokers by combined latency + stability signals", () => {
    const rows: LatencyBrokerComparisonRow[] = [
      { brokerId: "b1", broker: "A", serverRegion: "LD4", averageLatencyMs: 80, p95LatencyMs: 140, p99LatencyMs: 220, packetLossPercent: 0.2, executionResponseTimeMs: 90, marketDataDelayMs: 100, stabilityScore: 92, rank: 0, recommendedUse: "—" },
      { brokerId: "b2", broker: "B", serverRegion: "NY4", averageLatencyMs: 160, p95LatencyMs: 260, p99LatencyMs: 420, packetLossPercent: 1.8, executionResponseTimeMs: 180, marketDataDelayMs: 200, stabilityScore: 58, rank: 0, recommendedUse: "—" }
    ];
    const ranked = brokerLatencyRanking(rows);
    expect(ranked[0]!.broker).toBe("A");
    expect(ranked[0]!.rank).toBe(1);
    expect(ranked[1]!.rank).toBe(2);
  });
});

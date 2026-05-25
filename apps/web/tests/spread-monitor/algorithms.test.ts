import { describe, expect, it } from "vitest";

import { calculateSpreadPips, shouldBlockExecution, spreadStatusFromThreshold } from "@/modules/mt5-infrastructure-and-broker-connectivity/spread-monitor/algorithms/spread-monitor.algorithms";
import type { SpreadThreshold } from "@/modules/mt5-infrastructure-and-broker-connectivity/spread-monitor/types/spread-monitor.types";

const threshold: SpreadThreshold = {
  id: "thr-1",
  symbol: null,
  normalizedSymbol: "EURUSD",
  assetClass: "Forex",
  brokerId: null,
  broker: null,
  accountType: "All",
  tradingSession: "All",
  strategyType: "All",
  newsImpactLevel: "High",
  volatilityRegime: "Normal",
  normalLimitPips: 0.8,
  warningLimitPips: 1.5,
  criticalLimitPips: 2.6,
  executionBlockLimitPips: 3.2,
  scalpingMaxSpreadPips: 1.0,
  newsMultiplier: 1.7,
  autoDisableEnabled: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

describe("Spread Monitor algorithms", () => {
  it("calculates spread pips from bid/ask and pip size", () => {
    expect(calculateSpreadPips(1.0849, 1.0851, 0.0001)).toBe(2.0);
    expect(calculateSpreadPips(156.3, 156.32, 0.01)).toBe(2.0);
  });

  it("classifies spread status by warning/critical thresholds", () => {
    expect(spreadStatusFromThreshold(1.1, threshold, false)).toBe("Normal");
    expect(spreadStatusFromThreshold(1.9, threshold, false)).toBe("Wide");
    expect(spreadStatusFromThreshold(3.1, threshold, false)).toBe("Critical");
  });

  it("blocks execution when spread exceeds block limit or news blackout triggers", () => {
    const blocked = shouldBlockExecution({
      currentSpreadPips: 3.4,
      rollingAveragePips: 1.1,
      deviationPercent: 120,
      stabilityScore: 52,
      threshold,
      newsBlackoutActive: false,
      brokerIsMateriallyWorseThanPeers: true,
      scalpingStrategy: false
    });
    expect(blocked.shouldBlock).toBe(true);
    expect(blocked.reasons.length).toBeGreaterThan(0);

    const news = shouldBlockExecution({
      currentSpreadPips: 2.4,
      rollingAveragePips: 1.2,
      deviationPercent: 40,
      stabilityScore: 90,
      threshold,
      newsBlackoutActive: true,
      brokerIsMateriallyWorseThanPeers: false,
      scalpingStrategy: false
    });
    expect(news.shouldBlock).toBe(true);
    expect(news.reasons).toContain("News blackout active");
  });
});


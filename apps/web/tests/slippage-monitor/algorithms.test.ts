import { describe, expect, it } from "vitest";

import { breachStatusFromThreshold, calculateSlippagePoints, pointsToPips } from "@/modules/mt5-infrastructure-and-broker-connectivity/slippage-monitor/algorithms/slippage-monitor.algorithms";
import type { SlippageThreshold } from "@/modules/mt5-infrastructure-and-broker-connectivity/slippage-monitor/types/slippage-monitor.types";

const threshold: SlippageThreshold = {
  id: "thr-1",
  symbol: null,
  normalizedSymbol: "EURUSD",
  assetClass: "Forex",
  brokerId: null,
  broker: null,
  accountType: "All",
  strategyType: "All",
  tradingSession: "All",
  newsImpactLevel: "High",
  volatilityRegime: "Normal",
  normalLimitPips: 0.2,
  warningLimitPips: 0.5,
  criticalLimitPips: 1.0,
  executionBlockLimitPips: 1.3,
  maxRetrySlippagePips: 0.9,
  newsMultiplier: 1.6,
  autoDisableEnabled: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

describe("Slippage Monitor algorithms", () => {
  it("calculates buy and sell slippage points correctly", () => {
    expect(calculateSlippagePoints({ direction: "Buy", requestedPrice: 1.1000, executedPrice: 1.1002, pointSize: 0.00001 })).toBe(20.0);
    expect(calculateSlippagePoints({ direction: "Sell", requestedPrice: 1.1000, executedPrice: 1.1002, pointSize: 0.00001 })).toBe(-20.0);
  });

  it("converts points to pips", () => {
    expect(pointsToPips(20, 10)).toBe(2.0);
    expect(pointsToPips(-5, 10)).toBe(-0.5);
  });

  it("classifies breach status using thresholds and news multiplier", () => {
    expect(breachStatusFromThreshold(0.3, threshold, false)).toBe("Normal");
    expect(breachStatusFromThreshold(0.6, threshold, false)).toBe("Warning");
    expect(breachStatusFromThreshold(1.1, threshold, false)).toBe("Critical");
    expect(breachStatusFromThreshold(1.4, threshold, false)).toBe("Blocked");
    expect(breachStatusFromThreshold(0.9, threshold, true)).toBe("Warning");
  });
});


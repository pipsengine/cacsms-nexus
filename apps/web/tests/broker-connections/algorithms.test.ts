import { describe, expect, it } from "vitest";

import {
  calculateBrokerHealth,
  detectExecutionDegradation,
  detectSpreadSpikes,
  rankBrokerReliability
} from "@/modules/mt5-infrastructure-and-broker-connectivity/broker-connections/algorithms/broker-connections.algorithms";
import { createBrokerConnectionsSeed } from "@/tests/fixtures/broker-connections.fixture";

describe("broker reliability and degradation algorithms", () => {
  const seed = createBrokerConnectionsSeed();

  it("ranks healthy execution above an unsafe disconnected broker", () => {
    const rankings = rankBrokerReliability(seed.brokers);
    expect(rankings.ranked[0].brokerName).toBe("IC Markets");
    expect(rankings.highestRiskBroker).toBe("FTMO");
  });

  it("scores an offline broker in the critical range", () => {
    const result = calculateBrokerHealth(seed.brokers[2], seed.incidents);
    expect(result.rating).toBe("Critical");
    expect(result.score).toBeLessThan(40);
  });

  it("detects multi-symbol spread spikes and execution degradation", () => {
    const spread = detectSpreadSpikes(seed.spreadLogs, "broker-ftmo");
    const execution = detectExecutionDegradation(seed.executionQuality, "broker-ftmo");
    expect(spread.detected).toBe(true);
    expect(spread.multipleSymbols).toBe(true);
    expect(execution.degraded).toBe(true);
    expect(execution.rejectionRate).toBe(100);
  });
});

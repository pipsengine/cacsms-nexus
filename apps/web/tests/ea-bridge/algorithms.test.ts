import { describe, expect, it } from "vitest";

import {
  calculateBridgeHealth,
  calculateDeliveryReliability,
  classifyTokenRisk,
  isDuplicateCommand,
  validateBridgePayload
} from "@/modules/mt5-infrastructure-and-broker-connectivity/ea-bridge/algorithms/ea-bridge.algorithms";
import { createEaBridgeSeed } from "@/modules/mt5-infrastructure-and-broker-connectivity/ea-bridge/data/ea-bridge.mock";

describe("EA bridge security and reliability algorithms", () => {
  it("scores bridge delivery reliability and health under failures", () => {
    const seed = createEaBridgeSeed();
    const reliability = calculateDeliveryReliability(seed.messages);
    const health = calculateBridgeHealth({ heartbeatPercent: 60, authenticationPercent: 60, messages: seed.messages, averageLatencyMs: 260, commandSuccessPercent: 50, feedbackPercent: 50, errorCount: 2 });
    expect(reliability.failed).toBeGreaterThan(0);
    expect(health.score).toBeLessThan(75);
  });

  it("classifies compromised token context as critical", () => {
    expect(classifyTokenRisk(createEaBridgeSeed().instances[2])).toBe("Critical");
  });

  it("rejects unsigned, stale, and replayed bridge messages", () => {
    const used = new Set(["used"]);
    expect(validateBridgePayload({ schemaVersion: "v1.0", nonce: "new", timestamp: new Date().toISOString(), signed: false, usedNonces: used }).valid).toBe(false);
    expect(validateBridgePayload({ schemaVersion: "v0.8", nonce: "new", timestamp: new Date().toISOString(), signed: true, usedNonces: used }).valid).toBe(false);
    expect(validateBridgePayload({ schemaVersion: "v1.0", nonce: "used", timestamp: new Date().toISOString(), signed: true, usedNonces: used }).valid).toBe(false);
  });

  it("blocks duplicate command identity and equivalent command replay", () => {
    const command = createEaBridgeSeed().commands[0];
    expect(isDuplicateCommand({ ...command }, [command])).toBe(true);
    expect(isDuplicateCommand({ ...command, commandUuid: "other-id" }, [command])).toBe(true);
  });
});

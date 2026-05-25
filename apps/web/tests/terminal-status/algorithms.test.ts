import { describe, expect, it } from "vitest";

import {
  calculateTerminalHealthScore,
  classifyHeartbeat,
  classifyResourcePressure,
  detectTerminalFreeze,
  evaluateSafeRestart,
  predictTerminalFailure
} from "@/modules/mt5-infrastructure-and-broker-connectivity/terminal-status/algorithms/terminal-status.algorithms";
import { createTerminalStatusSeed } from "@/modules/mt5-infrastructure-and-broker-connectivity/terminal-status/data/terminal-status.mock";

describe("terminal status monitoring algorithms", () => {
  it("classifies heartbeat thresholds exactly", () => {
    expect(classifyHeartbeat(30)).toBe("Healthy");
    expect(classifyHeartbeat(31)).toBe("Watch");
    expect(classifyHeartbeat(61)).toBe("Degraded");
    expect(classifyHeartbeat(121)).toBe("Critical");
    expect(classifyHeartbeat(301)).toBe("Offline");
  });

  it("identifies resource pressure and terminal freeze conditions", () => {
    const terminal = createTerminalStatusSeed().terminals[2];
    expect(classifyResourcePressure(terminal).level).toBe("Critical");
    expect(detectTerminalFreeze(terminal).state).toBe("Freeze Confirmed");
    expect(calculateTerminalHealthScore(terminal).score).toBeLessThan(40);
  });

  it("predicts failure from heartbeat and resource history", () => {
    const seed = createTerminalStatusSeed();
    const prediction = predictTerminalFailure(seed.terminals[2], seed.heartbeatLogs);
    expect(prediction.probability).toBeGreaterThan(75);
    expect(prediction.severity).toBe("Critical");
  });

  it("prevents unsafe automatic restarts during order submission", () => {
    const terminal = { ...createTerminalStatusSeed().terminals[2], pendingOrdersCount: 1 };
    const decision = evaluateSafeRestart(terminal);
    expect(decision.safe).toBe(false);
    expect(decision.blockers).toContain("Pending order submission exists.");
  });
});

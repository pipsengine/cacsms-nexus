import { beforeEach, describe, expect, it } from "vitest";

import {
  disableUnsafeExecution,
  resetSlippageMonitorState,
  slippageMonitorRole,
  thresholds,
  updateThreshold
} from "@/app/api/mt5/slippage-monitor/_lib/store";

describe("Slippage Monitor API domain and security", () => {
  beforeEach(() => resetSlippageMonitorState());

  it("defaults to read-only role when no header provided", () => {
    expect(slippageMonitorRole(new Request("http://localhost/api/mt5/slippage-monitor/summary"))).toBe("Read-Only Viewer");
  });

  it("enforces critical threshold change approvals", () => {
    const thr = thresholds().thresholds[0]!;
    expect(() => updateThreshold(thr.id, { warningLimitPips: thr.warningLimitPips + 0.1 }, "Trading Admin")).not.toThrow();
    expect(() => updateThreshold(thr.id, { criticalLimitPips: thr.criticalLimitPips + 0.2 }, "Trading Admin")).toThrow(/not authorized/i);
    expect(() => updateThreshold(thr.id, { criticalLimitPips: thr.criticalLimitPips + 0.2 }, "Risk Manager")).not.toThrow();
  });

  it("restricts disabling unsafe execution to super/risk roles", () => {
    expect(() => disableUnsafeExecution("Analyst")).toThrow(/not authorized/i);
    expect(() => disableUnsafeExecution("Super Admin")).not.toThrow();
  });
});


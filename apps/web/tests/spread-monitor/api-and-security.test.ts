import { beforeEach, describe, expect, it } from "vitest";

import {
  disableExecution,
  resetSpreadMonitorState,
  spreads,
  spreadMonitorRole,
  thresholds,
  updateThreshold
} from "@/app/api/mt5/spread-monitor/_lib/store";

describe("Spread Monitor API domain and security", () => {
  beforeEach(() => resetSpreadMonitorState());

  it("defaults to read-only role when no header provided", () => {
    expect(spreadMonitorRole(new Request("http://localhost/api/mt5/spread-monitor/summary"))).toBe("Read-Only Viewer");
  });

  it("lists spreads with derived status and execution flags", () => {
    const list = spreads({ page: 1, pageSize: 50 });
    expect(list.spreads.length).toBeGreaterThan(0);
    expect(["Normal", "Wide", "Critical", "Unknown"]).toContain(list.spreads[0]!.spreadStatus);
  });

  it("enforces critical threshold change approvals", () => {
    const thr = thresholds().thresholds[0]!;
    expect(() => updateThreshold(thr.id, { warningLimitPips: thr.warningLimitPips + 0.2 }, "Trading Admin")).not.toThrow();
    expect(() => updateThreshold(thr.id, { criticalLimitPips: thr.criticalLimitPips + 0.4 }, "Trading Admin")).toThrow(/not authorized/i);
    expect(() => updateThreshold(thr.id, { criticalLimitPips: thr.criticalLimitPips + 0.4 }, "Risk Manager")).not.toThrow();
  });

  it("restricts execution overrides to trading/risk/super roles", () => {
    expect(() => disableExecution("XAUUSD", "Read-Only Viewer")).toThrow(/not authorized/i);
    expect(() => disableExecution("XAUUSD", "Trading Admin")).not.toThrow();
  });
});


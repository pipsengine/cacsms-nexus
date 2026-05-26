import { beforeEach, describe, expect, it } from "vitest";

import {
  disableRoute,
  enableRoute,
  latencyMonitorRole,
  resetLatencyMonitorState,
  testPing,
  thresholds,
  updateThreshold
} from "@/app/api/mt5/latency-monitor/_lib/store";

describe("Latency Monitor API domain and security", () => {
  beforeEach(() => resetLatencyMonitorState());

  it("defaults to read-only role when no header provided", () => {
    expect(latencyMonitorRole(new Request("http://localhost/api/mt5/latency-monitor/summary"))).toBe("Read-Only Viewer");
  });

  it("restricts route enable to risk/super roles and allows disable for trading admin", () => {
    expect(() => disableRoute("Trading Admin", "metric-001")).not.toThrow();
    expect(() => enableRoute("Trading Admin", "metric-001")).toThrow(/not authorized/i);
    expect(() => enableRoute("Risk Manager", "metric-001")).not.toThrow();
  });

  it("restricts ping tests to infrastructure/risk/super roles", () => {
    expect(() => testPing("Analyst", "metric-001")).toThrow(/not authorized/i);
    expect(() => testPing("Infrastructure Admin", "metric-001")).not.toThrow();
  });

  it("enforces critical threshold change approvals", () => {
    const thr = thresholds().thresholds[0]!;
    expect(() => updateThreshold(thr.id, { warningLatencyLimitMs: thr.warningLatencyLimitMs + 10 }, "Trading Admin")).not.toThrow();
    expect(() => updateThreshold(thr.id, { criticalLatencyLimitMs: thr.criticalLatencyLimitMs + 10 }, "Trading Admin")).toThrow(/not authorized/i);
    expect(() => updateThreshold(thr.id, { criticalLatencyLimitMs: thr.criticalLatencyLimitMs + 10 }, "Risk Manager")).not.toThrow();
  });
});


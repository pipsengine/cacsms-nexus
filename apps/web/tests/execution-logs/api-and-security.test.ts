import { beforeEach, describe, expect, it } from "vitest";

import { autoRemediate, diagnostics, executionLogsRole, exportLogs, listLogs, markReviewed, resetExecutionLogsState, sync } from "@/app/api/mt5/execution-logs/_lib/store";

describe("Execution Logs API domain and security", () => {
  beforeEach(() => resetExecutionLogsState());

  it("defaults to read-only role when no header provided", () => {
    expect(executionLogsRole(new Request("http://localhost/api/mt5/execution-logs/summary"))).toBe("Read-Only Viewer");
  });

  it("restricts marking reviewed to trading/super roles", () => {
    const log = listLogs({ page: 1, pageSize: 50 }).logs[0]!;
    expect(() => markReviewed(log.logId, {}, "Read-Only Viewer")).toThrow(/not authorized/i);
    expect(() => markReviewed(log.logId, {}, "Analyst")).toThrow(/not authorized/i);
    expect(() => markReviewed(log.logId, { reviewedBy: "ops" }, "Trading Admin")).not.toThrow();
  });

  it("restricts diagnostics to infra/trading/super roles", () => {
    expect(() => diagnostics("Analyst", null)).toThrow(/not authorized/i);
    expect(() => diagnostics("Trading Admin", null)).not.toThrow();
    expect(() => diagnostics("Infrastructure Admin", null)).not.toThrow();
  });

  it("allows export for viewer role", () => {
    const res = exportLogs({ format: "json" }, "Read-Only Viewer");
    expect(res.ok).toBe(true);
    expect(res.message).toContain("generatedAt");
  });

  it("sync requires elevated roles", () => {
    expect(() => sync("Read-Only Viewer")).toThrow(/not authorized/i);
    expect(() => sync("Trading Admin")).not.toThrow();
  });

  it("auto-remediation restricted to infra/super roles", () => {
    const log = listLogs({ page: 1, pageSize: 50 }).logs.find((l) => !l.mt5Ticket && (l.executionStatus === "Timed Out" || l.executionStatus === "Missing Feedback")) ?? listLogs({ page: 1, pageSize: 50 }).logs[0]!;
    expect(() => autoRemediate("Trading Admin", log.logId)).toThrow(/not authorized/i);
    expect(() => autoRemediate("Infrastructure Admin", log.logId)).not.toThrow();
  });
});


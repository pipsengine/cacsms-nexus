import { beforeEach, describe, expect, it } from "vitest";

import {
  autoRemediate,
  diagnostics,
  errorLogsRole,
  exportReport,
  listErrors,
  resetErrorLogsState,
  resolveError
} from "@/app/api/mt5/error-logs/_lib/store";

describe("MT5 Error Logs API domain and security", () => {
  beforeEach(() => resetErrorLogsState());

  it("defaults to read-only role when no header provided", () => {
    expect(errorLogsRole(new Request("http://localhost/api/mt5/error-logs/summary"))).toBe("Read-Only Viewer");
  });

  it("restricts diagnostics to non-viewer/non-analyst roles", () => {
    expect(() => diagnostics("Analyst", null)).toThrow(/not authorized/i);
    expect(() => diagnostics("Read-Only Viewer", null)).toThrow(/not authorized/i);
    expect(() => diagnostics("Risk Manager", null)).not.toThrow();
  });

  it("enforces resolve scope (infra vs trading)", () => {
    const terminalErr = listErrors({ page: 1, pageSize: 200 }).errors.find((e) => e.sourceModule === "MT5 Terminal");
    const queueErr = listErrors({ page: 1, pageSize: 200 }).errors.find((e) => e.sourceModule === "Execution Queue");
    expect(terminalErr).toBeTruthy();
    expect(queueErr).toBeTruthy();

    expect(() => resolveError(terminalErr!.errorId, { resolutionAction: "Fix", resolutionNote: "Done" }, "Trading Admin")).toThrow(/not authorized/i);
    expect(() => resolveError(terminalErr!.errorId, { resolutionAction: "Fix", resolutionNote: "Done" }, "Infrastructure Admin")).not.toThrow();

    expect(() => resolveError(queueErr!.errorId, { resolutionAction: "Fix", resolutionNote: "Done" }, "Infrastructure Admin")).toThrow(/not authorized/i);
    expect(() => resolveError(queueErr!.errorId, { resolutionAction: "Fix", resolutionNote: "Done" }, "Trading Admin")).not.toThrow();
  });

  it("restricts auto-remediation to infra/super roles", () => {
    const err = listErrors({ page: 1, pageSize: 50 }).errors[0]!;
    expect(() => autoRemediate("Risk Manager", err.errorId)).toThrow(/not authorized/i);
    expect(() => autoRemediate("Infrastructure Admin", err.errorId)).not.toThrow();
  });

  it("allows report export for viewer role", () => {
    const res = exportReport({ format: "json" }, "Read-Only Viewer");
    expect(res.ok).toBe(true);
    expect(res.message).toContain("generatedAt");
  });
});


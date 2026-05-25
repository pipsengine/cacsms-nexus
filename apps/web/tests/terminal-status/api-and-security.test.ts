import { describe, expect, it } from "vitest";

import {
  buildTerminalStatusResponse,
  restartTerminalStatus,
  runTerminalHealthCheck,
  setTerminalTrading,
  syncTerminalAccount,
  terminalAudits
} from "@/app/api/mt5/terminal-status/_lib/store";

describe("terminal status domain and permissions", () => {
  it("provides a terminal-focused operational response", () => {
    const response = buildTerminalStatusResponse("Infrastructure Admin");
    expect(response.kpis).toHaveLength(12);
    expect(response.workflow).toHaveLength(9);
    expect(response.terminals.length).toBeGreaterThan(0);
    expect(response.heartbeatLogs.length).toBeGreaterThan(0);
    expect(response.errors.length).toBeGreaterThan(0);
    expect(response.diagnostics.length).toBeGreaterThan(0);
  });

  it("blocks unconfirmed or read-only restricted actions", () => {
    expect(() => restartTerminalStatus("term-fra-03", "Read-Only Viewer", true)).toThrow(/not authorized/);
    expect(() => restartTerminalStatus("term-fra-03", "Infrastructure Admin", false)).toThrow(/Confirmation/);
    expect(() => setTerminalTrading("term-ld4-01", false, "Read-Only Viewer", true)).toThrow(/not authorized/);
  });

  it("writes audit records for health checks and controlled recovery", () => {
    const before = terminalAudits().length;
    runTerminalHealthCheck("term-fra-03", "Infrastructure Admin", true);
    syncTerminalAccount("term-fra-03", "Infrastructure Admin", true);
    restartTerminalStatus("term-fra-03", "Infrastructure Admin", true);
    expect(terminalAudits().length).toBeGreaterThanOrEqual(before + 3);
    expect(terminalAudits().some((record) => record.action === "Terminal restart")).toBe(true);
    expect(terminalAudits().some((record) => record.action === "Terminal account sync")).toBe(true);
  });
});

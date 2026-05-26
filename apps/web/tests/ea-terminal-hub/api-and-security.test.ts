import {describe, expect, it, beforeEach } from "vitest";
import { seedEaTerminalHubStore } from "@/tests/helpers/seed-api-stores";

import {
  buildEaTerminalHubResponse,
  connectTerminals,
  disconnectTerminals,
  eaTerminalHubRole,
  linkTerminalFolder,
  previewTerminalSync
} from "@/app/api/mt5/ea-terminal-hub/_lib/store";

describe("EA Terminal Hub API", () => {
  beforeEach(() => seedEaTerminalHubStore());
  it("returns hub summary, permissions, and install checklist", async () => {
    const response = await buildEaTerminalHubResponse("Infrastructure Admin");
    expect(response.summary.totalTerminals).toBeGreaterThan(0);
    expect(response.terminals.length).toBeGreaterThan(0);
    expect(response.workflow.length).toBeGreaterThan(0);
    expect(response.installChecklist.length).toBeGreaterThan(0);
    expect(response.permissions.canScan).toBe(true);
  });

  it("defaults to read-only viewer role", () => {
    expect(eaTerminalHubRole(new Request("http://localhost/api/mt5/ea-terminal-hub"))).toBe("Read-Only Viewer");
  });

  it("enforces role and confirmation on connect", async () => {
    await expect(connectTerminals({ terminalIds: ["term-ld4-01"], confirmed: true }, "Read-Only Viewer")).rejects.toThrow(/not authorized/);
    await expect(connectTerminals({ terminalIds: ["term-ld4-01"], confirmed: false }, "Infrastructure Admin")).rejects.toThrow(/Confirmation/);
  });

  it("manages and unmanagers terminals", async () => {
    const connected = await connectTerminals({ terminalIds: ["term-lon-04"], confirmed: true, autoLink: false }, "Infrastructure Admin");
    expect(connected.terminals?.[0]?.operatorManaged).toBe(true);
    const disconnected = disconnectTerminals(["term-lon-04"], "Infrastructure Admin", true);
    expect(disconnected.terminals?.[0]?.operatorManaged).toBe(false);
  });

  it("restricts folder linking to infrastructure roles", async () => {
    await expect(linkTerminalFolder({ terminalId: "term-ld4-01", confirmed: true }, "Trading Admin")).rejects.toThrow(/not authorized/);
  });

  it("generates sync preview for a terminal", async () => {
    const preview = await previewTerminalSync("term-ld4-01", "Infrastructure Admin");
    expect(preview.ok).toBe(true);
    expect(Array.isArray(preview.preview)).toBe(true);
  });
});

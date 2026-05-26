import {describe, expect, it, beforeEach } from "vitest";
import { seedMt5ControlCenterStore } from "@/tests/helpers/seed-api-stores";

import {
  buildControlCenter,
  getAuditRecords,
  getRole,
  restartTerminal,
  syncBrokers
} from "@/app/api/mt5/_lib/store";

describe("MT5 control API domain", () => {
  beforeEach(() => seedMt5ControlCenterStore());
  it("builds every operational control-center section", () => {
    const dashboard = buildControlCenter("Infrastructure Admin");
    expect(dashboard.kpis).toHaveLength(10);
    expect(dashboard.terminals.length).toBeGreaterThan(0);
    expect(dashboard.brokers.length).toBeGreaterThan(0);
    expect(dashboard.accounts.length).toBeGreaterThan(0);
    expect(dashboard.symbols.length).toBeGreaterThan(0);
    expect(dashboard.diagnostics.length).toBeGreaterThan(0);
    expect(dashboard.workflow).toHaveLength(9);
  });

  it("prevents read-only terminal restarts", () => {
    expect(getRole(new Request("http://localhost/api/mt5"))).toBe("Read-Only Viewer");
    expect(() => restartTerminal("term-ld4-01", "Read-Only Viewer")).toThrow(/not authorized/);
  });

  it("records audits for sensitive broker synchronization", () => {
    const count = getAuditRecords().length;
    syncBrokers("Infrastructure Admin");
    expect(getAuditRecords().length).toBe(count + 1);
    expect(getAuditRecords()[0].action).toBe("Broker synchronization");
  });
});

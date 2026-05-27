import { describe, expect, it, beforeEach } from "vitest";
import { seedMt5ControlCenterStore } from "@/tests/helpers/seed-api-stores";

import {
  buildControlCenter,
  getAuditRecords,
  getBrokers,
  getRole,
  registerBroker,
  resetMt5ControlCenterState,
  restartTerminal,
  syncBrokers
} from "@/app/api/mt5/_lib/store";
import { provisionBrokerConnectionFromRegistration } from "@/app/api/mt5/broker-connections/_lib/store";
import { resetBrokerConnectionsState } from "@/app/api/mt5/broker-connections/_lib/store";

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

  it("registers a broker and mirrors it into broker connections", () => {
    resetMt5ControlCenterState();
    resetBrokerConnectionsState();
    const broker = registerBroker({
      id: "broker-custom",
      brokerName: "Custom Broker",
      brokerCode: "CUST",
      mt5ServerName: "Custom-Live01",
      serverRegion: "London",
      connectionMode: "MT5 TCP",
      confirmed: true
    }, "Infrastructure Admin");
    provisionBrokerConnectionFromRegistration(broker, "Infrastructure Admin");
    expect(getBrokers()).toHaveLength(1);
    expect(broker.id).toBe("broker-custom");
  });
});

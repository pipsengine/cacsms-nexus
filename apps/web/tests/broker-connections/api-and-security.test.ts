import { describe, expect, it } from "vitest";

import {
  approveBrokerRestoration,
  brokerAudits,
  brokerIncidents,
  buildBrokerConnectionsResponse,
  reconnectBroker,
  setBrokerExecution,
  testBrokerConnection
} from "@/app/api/mt5/broker-connections/_lib/store";

describe("broker connection controls", () => {
  it("returns operational dashboard sections and rankings", () => {
    const response = buildBrokerConnectionsResponse("Infrastructure Admin");
    expect(response.kpis).toHaveLength(12);
    expect(response.workflow).toHaveLength(9);
    expect(response.brokers.length).toBeGreaterThan(0);
    expect(response.rankings.highestRiskBroker).toBe("FTMO");
    expect(response.diagnostics.length).toBeGreaterThan(0);
  });

  it("enforces confirmation and read-only permissions", () => {
    expect(() => reconnectBroker("broker-ftmo", "Read-Only Viewer", true)).toThrow(/not authorized/);
    expect(() => testBrokerConnection("broker-icm", "Infrastructure Admin", false)).toThrow(/Confirmation/);
    expect(() => setBrokerExecution("broker-icm", false, "Read-Only Viewer", true)).toThrow(/not authorized/);
  });

  it("records test and reconnect actions in the incident and audit trails", () => {
    const auditsBefore = brokerAudits().length;
    const incidentsBefore = brokerIncidents("broker-ftmo").length;
    const test = testBrokerConnection("broker-ftmo", "Infrastructure Admin", true);
    reconnectBroker("broker-ftmo", "Infrastructure Admin", true);
    expect(test.testStatus).toBe("Critical");
    expect(brokerIncidents("broker-ftmo").length).toBeGreaterThan(incidentsBefore);
    expect(brokerAudits().length).toBeGreaterThanOrEqual(auditsBefore + 2);
  });

  it("allows trading administrators to disable healthy execution but blocks unsafe restoration", () => {
    expect(setBrokerExecution("broker-icm", false, "Trading Admin", true).executionEnabled).toBe(false);
    expect(() => setBrokerExecution("broker-ftmo", true, "Trading Admin", true)).toThrow(/restoration blocked/);
    expect(() => approveBrokerRestoration("broker-ftmo", "Trading Admin", true)).toThrow(/not authorized/);
    expect(approveBrokerRestoration("broker-ftmo", "Risk Manager", true).approved).toBe(true);
    expect(setBrokerExecution("broker-ftmo", true, "Trading Admin", true).executionEnabled).toBe(true);
  });
});

import { describe, expect, it } from "vitest";

import { buildFingerprints, errorSeverityScore, fingerprintFor, normalizeMessage } from "@/modules/mt5-infrastructure-and-broker-connectivity/mt5-error-logs/algorithms/mt5-error-logs.algorithms";
import type { Mt5ErrorLog } from "@/modules/mt5-infrastructure-and-broker-connectivity/mt5-error-logs/types/mt5-error-logs.types";

describe("MT5 Error Logs algorithms", () => {
  it("normalizes messages and produces stable fingerprints for duplicates", () => {
    const a = normalizeMessage("Terminal heartbeat missed for 30s on host VM-2");
    const b = normalizeMessage("Terminal heartbeat missed for 45s on host VM-5");
    expect(a).toContain("<n>");
    expect(b).toContain("<n>");

    const base: Omit<Mt5ErrorLog, "fingerprintHash"> = {
      id: "err-001",
      errorId: "ERR-1001",
      occurredAt: new Date().toISOString(),
      sourceModule: "MT5 Terminal",
      errorType: "Heartbeat Timeout",
      severity: "Warning",
      brokerId: "broker-icm",
      broker: "IC Markets",
      accountId: "acct-1",
      account: "A1",
      terminalId: "term-1",
      terminal: "Terminal-1",
      eaInstanceId: null,
      eaInstance: null,
      symbol: null,
      orderId: null,
      tradeId: null,
      mt5Ticket: null,
      errorCode: "HB-408",
      errorMessage: "Terminal heartbeat missed for 30s on host VM-2",
      technicalDetails: null,
      stackTrace: "Error: Heartbeat Timeout\n  at Mt5Connector.handle\n  at Worker.run",
      payloadHash: "pl-0001",
      statusBefore: "Healthy",
      statusAfter: "Degraded",
      repeatCount: 3,
      firstSeenAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
      resolutionStatus: "Unresolved",
      assignedTo: null,
      riskLevel: "Moderate",
      environment: "Production",
      hostMachine: "MT5-HOST-1",
      aiRiskScore: 52,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const e1: Mt5ErrorLog = { ...base, fingerprintHash: "" };
    e1.fingerprintHash = fingerprintFor(e1);
    const e2: Mt5ErrorLog = { ...base, errorId: "ERR-1002", errorMessage: "Terminal heartbeat missed for 45s on host VM-5", fingerprintHash: "" };
    e2.fingerprintHash = fingerprintFor(e2);

    expect(e1.fingerprintHash).toBe(e2.fingerprintHash);
  });

  it("builds duplicate groups using fingerprint hash", () => {
    const mk = (errorId: string, msg: string): Mt5ErrorLog => {
      const e: Mt5ErrorLog = {
        id: errorId,
        errorId,
        occurredAt: new Date().toISOString(),
        sourceModule: "Broker Connection",
        errorType: "Broker Disconnect",
        severity: "Critical",
        brokerId: "broker-icm",
        broker: "IC Markets",
        accountId: "acct-1",
        account: "A1",
        terminalId: "term-1",
        terminal: "Terminal-1",
        eaInstanceId: null,
        eaInstance: null,
        symbol: null,
        orderId: null,
        tradeId: null,
        mt5Ticket: null,
        errorCode: "10054",
        errorMessage: msg,
        technicalDetails: null,
        stackTrace: null,
        payloadHash: null,
        statusBefore: null,
        statusAfter: null,
        repeatCount: 1,
        firstSeenAt: new Date().toISOString(),
        lastSeenAt: new Date().toISOString(),
        resolutionStatus: "Unresolved",
        assignedTo: null,
        riskLevel: "High",
        environment: "Production",
        hostMachine: "BRIDGE-1",
        fingerprintHash: "",
        aiRiskScore: 90,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      e.fingerprintHash = fingerprintFor(e);
      return e;
    };

    const a = mk("ERR-A", "Broker socket reset by peer during keep-alive cycle 10");
    const b = mk("ERR-B", "Broker socket reset by peer during keep-alive cycle 11");
    const c = mk("ERR-C", "Some different broker error message");

    const groups = buildFingerprints([a, b, c]);
    expect(groups.length).toBeGreaterThanOrEqual(2);
    expect(groups.find((g) => g.fingerprintHash === a.fingerprintHash)?.repeatCount).toBeGreaterThanOrEqual(2);
  });

  it("computes severity score and escalates for unsafe repeated issues", () => {
    const scored = errorSeverityScore({
      sourceModule: "Execution Queue",
      errorType: "Execution Queue Backpressure",
      repeatCount: 12,
      minutesUnresolved: 240,
      affectedAccounts: 10,
      brokerWide: true,
      unsafeTrading: true
    });
    expect(scored.score).toBeGreaterThan(70);
    expect(["Critical", "Emergency"]).toContain(scored.severity);
  });
});


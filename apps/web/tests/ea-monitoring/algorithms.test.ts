import { describe, expect, it } from "vitest";

import { buildWorkflow, eaHealthScore, readinessValidation, strategyBindingIntegrity, suspiciousBehavior } from "@/modules/mt5-infrastructure-and-broker-connectivity/ea-monitoring/algorithms/ea-monitoring.algorithms";

describe("EA Monitoring algorithms", () => {
  it("computes readiness validation blockers and execution readiness", () => {
    const ready = readinessValidation({
      heartbeatStatus: "Active",
      connectionStatus: "Online",
      bridgeStatus: "Connected",
      strategyId: "STR-1",
      symbolScope: ["EURUSD"],
      riskRulesLoaded: true,
      tradingEnabled: true,
      emergencyStopActive: false,
      spreadFilterActive: true,
      slippageFilterActive: true,
      latencyFilterActive: true,
      duplicateProtectionActive: true,
      accountTradingAllowed: true,
      symbolTradingAllowed: true
    });
    expect(ready.executionReady).toBe(true);
    expect(ready.blockers).toEqual([]);

    const blocked = readinessValidation({
      heartbeatStatus: "Missing",
      connectionStatus: "Offline",
      bridgeStatus: "Disconnected",
      strategyId: null,
      symbolScope: [],
      riskRulesLoaded: false,
      tradingEnabled: false,
      emergencyStopActive: true,
      spreadFilterActive: false,
      slippageFilterActive: false,
      latencyFilterActive: false,
      duplicateProtectionActive: false,
      accountTradingAllowed: false,
      symbolTradingAllowed: false
    });
    expect(blocked.executionReady).toBe(false);
    expect(blocked.blockers).toContain("heartbeat-not-active");
    expect(blocked.blockers).toContain("terminal-offline");
    expect(blocked.blockers).toContain("bridge-disconnected");
    expect(blocked.blockers).toContain("trading-disabled");
    expect(blocked.blockers).toContain("emergency-stop-active");
  });

  it("detects strategy binding integrity mismatches", () => {
    const instance = {
      strategyId: "STR-2",
      strategyVersion: "v1.2.3",
      symbolScope: ["EURUSD", "XAUUSD"],
      timeframeScope: ["M5"],
      riskProfile: "Conservative"
    };

    const ok = strategyBindingIntegrity(instance, {
      id: "b1",
      eaId: "EA-1000",
      eaInstance: "NexusBridgeEA",
      strategyId: "STR-2",
      strategyName: "Strategy STR-2",
      strategyVersion: "v1.2.3",
      symbolsAllowed: ["EURUSD", "XAUUSD"],
      timeframesAllowed: ["M5"],
      riskProfile: "Conservative",
      maxRiskPerTrade: 1,
      maxDailyRisk: 4,
      tradeFrequencyLimit: 8,
      tradingSessionRules: "All day",
      newsRestrictionStatus: "Loaded",
      bindingStatus: "Bound",
      lastBindingUpdateAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    expect(ok.ok).toBe(true);

    const bad = strategyBindingIntegrity(instance, {
      id: "b2",
      eaId: "EA-1000",
      eaInstance: "NexusBridgeEA",
      strategyId: "STR-9",
      strategyName: "Wrong",
      strategyVersion: "v9.0.0",
      symbolsAllowed: ["EURUSD"],
      timeframesAllowed: ["M1"],
      riskProfile: "Aggressive",
      maxRiskPerTrade: 3,
      maxDailyRisk: 10,
      tradeFrequencyLimit: 50,
      tradingSessionRules: "All day",
      newsRestrictionStatus: "Missing",
      bindingStatus: "Mismatch",
      lastBindingUpdateAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    expect(bad.ok).toBe(false);
    expect(bad.issues).toEqual(expect.arrayContaining(["wrong-strategy", "strategy-version-mismatch", "symbol-scope-mismatch", "timeframe-scope-mismatch", "risk-profile-mismatch", "news-restrictions-not-loaded", "binding-status-not-bound"]));
  });

  it("flags suspicious EA behavior", () => {
    const res = suspiciousBehavior(
      { tradingEnabled: false, emergencyStopActive: true, symbolScope: ["EURUSD"], strategyId: null },
      { commandsOutsideStrategy: 3, unauthorizedSymbols: 1, excessiveFrequency: true, duplicateOrders: 2 }
    );
    expect(res.suspicious).toBe(true);
    expect(res.flags).toEqual(
      expect.arrayContaining([
        "trading-after-emergency-stop",
        "trading-while-disabled",
        "commands-without-strategy",
        "commands-outside-strategy",
        "unauthorized-symbol",
        "excessive-frequency",
        "duplicate-order-attempts"
      ])
    );
  });

  it("keeps EA health score within 0..100 and degrades with outages", () => {
    const healthy = eaHealthScore({
      heartbeatDelaySeconds: 2,
      heartbeatStatus: "Active",
      bridgeStatus: "Connected",
      strategyBindingOk: true,
      commandSuccessRate: 98,
      executionFeedbackStatus: "Ready",
      riskRulesLoaded: true,
      riskLevel: "Low",
      restartCount: 0,
      errorFrequency: 0
    });
    expect(healthy).toBeGreaterThanOrEqual(0);
    expect(healthy).toBeLessThanOrEqual(100);

    const bad = eaHealthScore({
      heartbeatDelaySeconds: 0,
      heartbeatStatus: "Missing",
      bridgeStatus: "Disconnected",
      strategyBindingOk: false,
      commandSuccessRate: 10,
      executionFeedbackStatus: "Down",
      riskRulesLoaded: false,
      riskLevel: "Critical",
      restartCount: 9,
      errorFrequency: 3
    });
    expect(bad).toBeLessThan(healthy);
  });

  it("builds the EA monitoring workflow with 10 nodes", () => {
    const wf = buildWorkflow(
      [
        {
          id: "ea-001",
          eaId: "EA-1000",
          eaName: "NexusBridgeEA",
          eaVersion: "1.1.1",
          buildNumber: "8000",
          magicNumber: "100",
          terminalId: "term-1",
          terminal: "Terminal-1",
          brokerId: "broker-icm",
          broker: "IC Markets",
          accountId: "acct-1",
          accountLogin: "A1-LIVE",
          hostMachine: "VPS-1",
          environment: "Production",
          strategyId: "STR-1",
          strategyName: "Strategy STR-1",
          strategyVersion: "v1.0.1",
          symbolScope: ["EURUSD"],
          timeframeScope: ["M5"],
          riskProfile: "Conservative",
          connectionStatus: "Online",
          heartbeatStatus: "Active",
          lastHeartbeatAt: new Date().toISOString(),
          heartbeatDelaySeconds: 2,
          bridgeStatus: "Connected",
          commandChannelStatus: "Ready",
          executionFeedbackStatus: "Ready",
          tradingEnabled: true,
          accountTradingAllowed: true,
          symbolTradingAllowed: true,
          riskRulesLoaded: true,
          duplicateProtectionActive: true,
          spreadFilterActive: true,
          slippageFilterActive: true,
          latencyFilterActive: true,
          emergencyStopActive: false,
          commandSuccessRate: 99,
          failedCommands: 0,
          averageLatencyMs: 120,
          uptimeSeconds: 1000,
          restartCount: 0,
          lastError: null,
          riskLevel: "Low",
          healthScore: 95,
          readiness: readinessValidation({
            heartbeatStatus: "Active",
            connectionStatus: "Online",
            bridgeStatus: "Connected",
            strategyId: "STR-1",
            symbolScope: ["EURUSD"],
            riskRulesLoaded: true,
            tradingEnabled: true,
            emergencyStopActive: false,
            spreadFilterActive: true,
            slippageFilterActive: true,
            latencyFilterActive: true,
            duplicateProtectionActive: true,
            accountTradingAllowed: true,
            symbolTradingAllowed: true
          }),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ],
      null
    );
    expect(wf).toHaveLength(10);
    expect(wf[0]?.title).toBe("EA Registered");
    expect(wf[9]?.title).toBe("Execution Feedback Active");
  });
});

import { beforeEach, describe, expect, it } from "vitest";
import { seedEaBridgeStore, seedOrderRouterStore, seedSlippageMonitorStore } from "@/tests/helpers/seed-api-stores";
import { createMockThresholds } from "@/tests/fixtures/slippage-monitor.fixture";
import { applyBridgeExecutionFeedback, submitTestOrderToEa } from "@/app/api/mt5/order-router/_lib/store";

import {
  disableUnsafeExecution,
  executions,
  ingestExecutionFromOrderRouter,
  resetSlippageMonitorState,
  slippageMonitorRole,
  summary,
  thresholds,
  updateThreshold,
  workflow
} from "@/app/api/mt5/slippage-monitor/_lib/store";

describe("Slippage Monitor API domain and security", () => {
  beforeEach(() => seedSlippageMonitorStore());

  it("defaults to infrastructure admin in local dev when no header provided", () => {
    expect(slippageMonitorRole(new Request("http://localhost/api/mt5/slippage-monitor/summary"))).toBe("Infrastructure Admin");
  });

  it("honors x-mt5-role header in local dev", () => {
    expect(
      slippageMonitorRole(
        new Request("http://localhost/api/mt5/slippage-monitor/summary", {
          headers: { "x-mt5-role": "Read-Only Viewer" }
        })
      )
    ).toBe("Read-Only Viewer");
  });

  it("enforces critical threshold change approvals", () => {
    resetSlippageMonitorState({ thresholds: createMockThresholds() });
    const thr = thresholds().thresholds[0]!;
    expect(() => updateThreshold(thr.id, { warningLimitPips: thr.warningLimitPips + 0.1 }, "Trading Admin")).not.toThrow();
    expect(() => updateThreshold(thr.id, { criticalLimitPips: thr.criticalLimitPips + 0.2 }, "Trading Admin")).toThrow(/not authorized/i);
    expect(() => updateThreshold(thr.id, { criticalLimitPips: thr.criticalLimitPips + 0.2 }, "Risk Manager")).not.toThrow();
  });

  it("restricts disabling unsafe execution to super/risk roles", () => {
    expect(() => disableUnsafeExecution("Analyst")).toThrow(/not authorized/i);
    expect(() => disableUnsafeExecution("Super Admin")).not.toThrow();
  });

  it("returns safe summary and workflow when store is empty", () => {
    resetSlippageMonitorState();
    expect(summary("Infrastructure Admin").kpis[0]?.value).toBe("0");
    expect(workflow().workflow.length).toBe(10);
    expect(() => executions({ page: 1, pageSize: 10 })).not.toThrow();
  });

  it("auto-creates thresholds and ingests executions from order-router feedback", () => {
    resetSlippageMonitorState();
    ingestExecutionFromOrderRouter({
      routeId: "route-test-1",
      orderId: "ORD-9001",
      accountId: "acct-1",
      accountLogin: "52877052",
      brokerId: "broker-icm",
      brokerName: "IC Markets",
      terminalId: "term-1",
      terminalName: "MT5-Terminal-1",
      eaInstanceId: "ea-cacsms-mt5-0001",
      eaInstanceName: "NexusBridgeEA",
      strategyId: "strat-1",
      strategyName: "Momentum Alpha",
      symbol: "GBPUSD",
      normalizedSymbol: "GBPUSD",
      direction: "Buy",
      orderType: "Market",
      requestedPrice: 1.2681,
      executedPrice: 1.26815,
      executionTimeMs: 48,
      executedAt: new Date().toISOString(),
      mt5Ticket: "540001"
    });

    expect(thresholds().thresholds.some((t) => t.normalizedSymbol === "GBPUSD")).toBe(true);
    expect(executions({ page: 1, pageSize: 10 }).executions).toHaveLength(1);
    expect(summary("Infrastructure Admin").kpis[0]?.value).toBe("1");
  });

  it("chains order-router execution feedback into slippage monitor", () => {
    resetSlippageMonitorState();
    seedOrderRouterStore();
    seedEaBridgeStore();
    const result = submitTestOrderToEa({ eaInstanceId: "ea-ld4-01", symbol: "EURUSD", volume: 0.01 }, "Trading Admin", true);
    applyBridgeExecutionFeedback({
      commandUuid: result.commandUuid!,
      status: "Executed",
      responseTimeMs: 52,
      executedAt: new Date().toISOString()
    });
    expect(executions({ page: 1, pageSize: 10 }).executions.length).toBeGreaterThan(0);
  });
});


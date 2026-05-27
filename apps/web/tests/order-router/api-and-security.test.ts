import {describe, expect, it, beforeEach } from "vitest";
import { seedEaBridgeStore, seedOrderRouterStore } from "@/tests/helpers/seed-api-stores";
import { buildEaBridgeResponse, setBridgeTrading } from "@/app/api/mt5/ea-bridge/_lib/store";
import {
  applyBridgeExecutionFeedback,
  buildOrderRouterResponse,
  cancelRoute,
  emergencyStopRouting,
  ingestStrategySignal,
  orderRouterRole,
  revalidateRoute,
  retryRoute,
  routerAudits,
  setRoutingPaused,
  submitTestOrderToEa
} from "@/app/api/mt5/order-router/_lib/store";

describe("Order Router operational controls", () => {
  beforeEach(() => {
    seedOrderRouterStore();
    seedEaBridgeStore();
  });
  it("returns routed, blocked, channel, feedback, log, and diagnostic sections", () => {
    const response = buildOrderRouterResponse("Infrastructure Admin");
    expect(response.kpis).toHaveLength(12);
    expect(response.workflow).toHaveLength(10);
    expect(response.routes.length).toBeGreaterThan(0);
    expect(response.channels.length).toBeGreaterThan(0);
    expect(response.blockedOrders.some((order) => order.blockReason === "Duplicate order")).toBe(true);
    expect(response.feedback.length).toBeGreaterThan(0);
    expect(response.diagnostics.length).toBeGreaterThan(0);
  });

  it("enforces role and confirmation restrictions", () => {
    expect(orderRouterRole(new Request("http://localhost/api/mt5/order-router"))).toBe("Read-Only Viewer");
    expect(() => retryRoute("route-005", "Read-Only Viewer", true)).toThrow(/not authorized/);
    expect(() => setRoutingPaused(true, "Trading Admin", false)).toThrow(/Confirmation/);
    expect(() => emergencyStopRouting("Trading Admin", true)).toThrow(/not authorized/);
  });

  it("blocks unsafe duplicate retries and cancellation of executed orders", () => {
    expect(() => retryRoute("route-004", "Trading Admin", true)).toThrow(/Unsafe retry blocked/);
    expect(() => cancelRoute("route-001", "Trading Admin", true)).toThrow(/Executed orders/);
    expect(revalidateRoute("route-004", "Risk Manager", true).validation.approved).toBe(false);
  });

  it("queues a confirmed safe retry using a healthy fallback and audits decisions", () => {
    const before = routerAudits().length;
    const route = retryRoute("route-005", "Trading Admin", true);
    expect(route.routingStatus).toBe("Routed");
    expect(route.brokerName).toBe("IC Markets");
    expect(route.bridgeCommandUuid).toBeTruthy();
    expect(routerAudits().length).toBeGreaterThan(before);
  });

  it("pauses, resumes, and emergency-stops all routing with Super Admin control", () => {
    expect(setRoutingPaused(true, "Trading Admin", true).routingPaused).toBe(true);
    expect(setRoutingPaused(false, "Trading Admin", true).routingPaused).toBe(false);
    const stopped = emergencyStopRouting("Super Admin", true);
    expect(stopped.emergencyStopActive).toBe(true);
    expect(() => setRoutingPaused(false, "Trading Admin", true)).toThrow(/emergency stop/);
  });

  it("queues a test order on the EA bridge execution channel", () => {
    const result = submitTestOrderToEa({ eaInstanceId: "ea-ld4-01", symbol: "EURUSD", volume: 0.01 }, "Trading Admin", true);
    expect(result.accepted).toBe(true);
    expect(result.commandUuid).toBeTruthy();
    expect(buildOrderRouterResponse("Trading Admin").routes[0]?.routingStatus).toBe("Routed");
  });

  it("autonomously routes test orders when the EA bridge channel was disabled", () => {
    seedOrderRouterStore();
    seedEaBridgeStore();
    setBridgeTrading("ea-ld4-01", false, "Super Admin", true);
    expect(buildEaBridgeResponse("Infrastructure Admin").instances.find((i) => i.id === "ea-ld4-01")?.tradingChannelEnabled).toBe(false);

    const result = submitTestOrderToEa({ eaInstanceId: "ea-ld4-01", symbol: "EURUSD", volume: 0.01 }, "Trading Admin", true);
    expect(result.accepted).toBe(true);
    expect(buildEaBridgeResponse("Infrastructure Admin").instances.find((i) => i.id === "ea-ld4-01")?.tradingChannelEnabled).toBe(true);
  });

  it("updates routed orders when EA bridge execution feedback arrives", () => {
    const result = submitTestOrderToEa({ eaInstanceId: "ea-ld4-01", symbol: "EURUSD", volume: 0.01 }, "Trading Admin", true);
    const route = applyBridgeExecutionFeedback({
      commandUuid: result.commandUuid!,
      status: "Executed",
      responseTimeMs: 42
    });
    expect(route?.executionStatus).toBe("Executed");
    expect(route?.routingStatus).toBe("Executed");
  });

  it("autonomously routes an approved strategy signal without manual dispatch", () => {
    const result = ingestStrategySignal(
      {
        strategyId: "momentum-alpha",
        strategyName: "Momentum Alpha",
        sourceEngine: "Strategy Orchestrator",
        symbol: "GBPUSD",
        direction: "Sell",
        volume: 0.02
      },
      "Trading Admin",
      true
    );
    expect(result.ok).toBe(true);
    expect(result.bridgeCommandUuid).toBeTruthy();
    expect(result.routingStatus).toBe("Routed");
    expect(buildOrderRouterResponse("Trading Admin").routes[0]?.sourceEngine).toBe("Strategy Orchestrator");
  });

  it("blocks duplicate autonomous strategy signals", () => {
    const payload = {
      signalId: "SIG-dup-test",
      strategyId: "dup-test-strategy",
      eaInstanceId: "ea-ld4-01",
      symbol: "GBPUSD",
      direction: "Sell" as const,
      volume: 0.02
    };
    const first = ingestStrategySignal(payload, "Trading Admin", true);
    expect(first.ok).toBe(true);
    const second = ingestStrategySignal(payload, "Trading Admin", true);
    expect(second.ok).toBe(false);
    expect(second.blocked).toBe(true);
    expect(second.blockReason?.toLowerCase()).toContain("duplicate");
  });
});

import { describe, expect, it } from "vitest";
import {
  buildOrderRouterResponse,
  cancelRoute,
  emergencyStopRouting,
  orderRouterRole,
  revalidateRoute,
  retryRoute,
  routerAudits,
  setRoutingPaused
} from "@/app/api/mt5/order-router/_lib/store";

describe("Order Router operational controls", () => {
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
    expect(route.routingStatus).toBe("Retried");
    expect(route.brokerName).toBe("IC Markets");
    expect(routerAudits().length).toBeGreaterThan(before);
  });

  it("pauses, resumes, and emergency-stops all routing with Super Admin control", () => {
    expect(setRoutingPaused(true, "Trading Admin", true).routingPaused).toBe(true);
    expect(setRoutingPaused(false, "Trading Admin", true).routingPaused).toBe(false);
    const stopped = emergencyStopRouting("Super Admin", true);
    expect(stopped.emergencyStopActive).toBe(true);
    expect(() => setRoutingPaused(false, "Trading Admin", true)).toThrow(/emergency stop/);
  });
});

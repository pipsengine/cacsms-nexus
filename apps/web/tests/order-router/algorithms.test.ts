import { describe, expect, it } from "vitest";
import { calculateRoutingHealth, duplicateProtection, evaluateRetrySafety, selectSmartRoute, validatePreRoute } from "@/modules/mt5-infrastructure-and-broker-connectivity/order-router/algorithms/order-router.algorithms";
import { createOrderRouterSeed } from "@/tests/fixtures/order-router.fixture";

describe("Order Router safety algorithms", () => {
  it("scores route health and recommends a healthy execution channel", () => {
    const seed = createOrderRouterSeed();
    const health = calculateRoutingHealth(seed.routes, seed.channels);
    const selection = selectSmartRoute(seed.channels);
    expect(health.score).toBeLessThan(90);
    expect(selection.primaryRoute.brokerName).toBe("IC Markets");
    expect(selection.unsafeRoutes.some((channel) => channel.brokerName === "FTMO")).toBe(true);
  });

  it("blocks any pre-route validation failure including emergency stop", () => {
    const valid = { signalApproved: true, strategyActive: true, accountSynced: true, accountTradingEnabled: true, brokerExecutionEnabled: true, terminalOnline: true, eaBridgeActive: true, symbolMapped: true, spreadAcceptable: true, marginSufficient: true, newsBlackoutClear: true, duplicateClear: true, riskApproved: true, emergencyStopActive: false };
    expect(validatePreRoute(valid).approved).toBe(true);
    expect(validatePreRoute({ ...valid, marginSufficient: false }).reason).toBe("Margin insufficient");
    expect(validatePreRoute({ ...valid, emergencyStopActive: true }).reason).toBe("Emergency stop active");
  });

  it("detects duplicate execution identity in the safety time window", () => {
    const seed = createOrderRouterSeed();
    expect(duplicateProtection(seed.routes[3], seed.routes).blocked).toBe(true);
    expect(duplicateProtection(seed.routes[4], seed.routes).blocked).toBe(false);
  });

  it("allows only confirmed, ticket-free and revalidated retries", () => {
    const seed = createOrderRouterSeed();
    const failed = seed.routes[4];
    expect(evaluateRetrySafety(failed, { feedbackConfirmsFailure: true, duplicateClear: true, priceWithinTolerance: true, riskRevalidated: true, targetHealthy: true }).safe).toBe(true);
    expect(evaluateRetrySafety(seed.routes[0], { feedbackConfirmsFailure: true, duplicateClear: true, priceWithinTolerance: true, riskRevalidated: true, targetHealthy: true }).safe).toBe(false);
  });
});

import { describe, expect, it } from "vitest";

import { classifyBrokerResponse, executionQualityScore, unsafeRetryDecision } from "@/modules/mt5-infrastructure-and-broker-connectivity/execution-logs/algorithms/execution-logs.algorithms";

describe("Execution Logs algorithms", () => {
  it("classifies broker response reasons and required fix", () => {
    const r = classifyBrokerResponse({ responseCode: "NO_MONEY", responseMessage: "Insufficient margin" });
    expect(r.rejectionReason).toMatch(/margin/i);
    expect(r.requiredFix.toLowerCase()).toContain("margin");
    expect(r.severity).toBe("Warning");
  });

  it("blocks unsafe retry when ticket exists or feedback missing", () => {
    const a = unsafeRetryDecision({
      mt5TicketExists: true,
      executionStatus: "Rejected",
      feedbackMissing: false,
      marketMovedBeyondTolerance: false,
      riskExpired: false,
      duplicateOrderRisk: false,
      retryCount: 0,
      maxRetryCount: 3
    });
    expect(a.safe).toBe(false);

    const b = unsafeRetryDecision({
      mt5TicketExists: false,
      executionStatus: "Timed Out",
      feedbackMissing: true,
      marketMovedBeyondTolerance: false,
      riskExpired: false,
      duplicateOrderRisk: true,
      retryCount: 1,
      maxRetryCount: 3
    });
    expect(b.safe).toBe(false);
    expect(b.reasons.length).toBeGreaterThan(0);
  });

  it("computes execution quality score within bounds", () => {
    const q = executionQualityScore({
      successRate: 0.85,
      averageExecutionTimeMs: 900,
      averageSlippagePoints: 6,
      rejectionRate: 0.05,
      requoteRate: 0.03,
      feedbackCompletenessRate: 0.96,
      retryRate: 0.08,
      timeoutRate: 0.01
    });
    expect(q.score).toBeGreaterThanOrEqual(0);
    expect(q.score).toBeLessThanOrEqual(100);
  });
});


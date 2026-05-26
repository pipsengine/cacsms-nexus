import { describe, expect, it } from "vitest";

import { buildExecutiveDashboardResponse } from "@/app/api/executive-overview/executive-dashboard/build-response";

describe("executive dashboard API response shape", () => {
  it("returns a structured response with required sections", () => {
    const response = buildExecutiveDashboardResponse();

    expect(response).toHaveProperty("meta");
    expect(response).toHaveProperty("summary");
    expect(response).toHaveProperty("systems");
    expect(response).toHaveProperty("workflowStages");
    expect(response).toHaveProperty("accountCompliance");
    expect(response).toHaveProperty("aiIntelligence");
    expect(response).toHaveProperty("marketCondition");
    expect(response).toHaveProperty("riskSummary");
    expect(response).toHaveProperty("visionSummary");
    expect(response).toHaveProperty("mt5BrokerSummary");
    expect(response).toHaveProperty("executionSummary");
    expect(response).toHaveProperty("recentDecisions");
    expect(response).toHaveProperty("alerts");

    expect(response.systems).toEqual([]);
    expect(response.workflowStages).toEqual([]);

    expect(response.summary.globalHealthScore.score).toBeGreaterThanOrEqual(0);
    expect(response.summary.globalHealthScore.score).toBeLessThanOrEqual(100);
    expect(typeof response.summary.aiConfidenceScore.explanation).toBe("string");
  });
});


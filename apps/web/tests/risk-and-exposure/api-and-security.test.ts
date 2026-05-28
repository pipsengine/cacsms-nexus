import { beforeEach, describe, expect, it } from "vitest";
import { seedAccountSyncStore } from "@/tests/helpers/seed-api-stores";
import { resetAccountCenterState } from "@/app/api/accounts-and-portfolio/account-center/_lib/store";
import { buildRiskAndExposureResponse, riskAndExposureRole } from "@/app/api/accounts-and-portfolio/risk-and-exposure/_lib/store";

describe("Risk and Exposure API domain and security", () => {
  beforeEach(() => {
    resetAccountCenterState();
    seedAccountSyncStore();
  });

  it("defaults to infrastructure admin in local dev when no header provided", () => {
    expect(riskAndExposureRole(new Request("http://localhost/api/accounts-and-portfolio/risk-and-exposure"))).toBe(
      "Infrastructure Admin"
    );
  });

  it("aggregates account center and sync exposure into a risk response", async () => {
    const response = await buildRiskAndExposureResponse("Infrastructure Admin");
    expect(response.accounts.length).toBeGreaterThan(0);
    expect(response.kpis.length).toBeGreaterThan(5);
    expect(response.symbolExposures.length).toBeGreaterThan(0);
    expect(response.meta.streamEndpoint).toContain("risk-and-exposure");
  });

  it("honors highlighted account query parameter", async () => {
    const response = await buildRiskAndExposureResponse("Infrastructure Admin");
    const target = response.accounts[1]?.accountId;
    if (!target) return;
    const highlighted = await buildRiskAndExposureResponse("Infrastructure Admin", target);
    expect(highlighted.meta.highlightedAccountId).toBe(target);
  });
});

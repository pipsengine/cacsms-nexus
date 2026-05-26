import { describe, expect, it } from "vitest";
import { calculateAccountSyncHealth, calculateExposureRisk, classifyReconciliation, detectSyncDelay, validateTradingReadiness } from "@/modules/mt5-infrastructure-and-broker-connectivity/account-sync/algorithms/account-sync.algorithms";
import { createAccountSyncSeed } from "@/tests/fixtures/account-sync.fixture";

describe("account synchronization algorithms", () => {
  const seed = createAccountSyncSeed();
  it("classifies material financial and position mismatches", () => {
    const result = classifyReconciliation(seed.reconciliations[1]);
    expect(result.status).toBe("Material Difference");
  });
  it("blocks unsafe account execution and detects stale sync", () => {
    const readiness = validateTradingReadiness(seed.accounts[2]);
    expect(readiness.executionReady).toBe(false);
    expect(detectSyncDelay(seed.accounts[2]).unsafe).toBe(true);
  });
  it("scores critical sync and exposure risk for stale prop account", () => {
    const score = calculateAccountSyncHealth(seed.accounts[2], seed.reconciliations[2]);
    const exposure = calculateExposureRisk(seed.accounts[2], seed.exposures);
    expect(score.rating).toBe("Critical");
    expect(exposure.riskLevel).toBe("Critical");
    expect(exposure.emergencyRiskFlag).toBe(true);
  });
});

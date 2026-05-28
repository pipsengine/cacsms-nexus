import { describe, expect, it } from "vitest";
import {
  buildAccountCenterWorkflow,
  buildGroupSummaries,
  classifyPortfolioCategory,
  evaluateSwitchEligibility,
  mapSyncedAccountToPortfolio,
  portfolioHealthScore
} from "@/modules/accounts-and-portfolio/account-center/algorithms/account-center.algorithms";
import { createAccountSyncSeed } from "@/tests/fixtures/account-sync.fixture";

describe("Account Center algorithms", () => {
  it("classifies portfolio categories from account type labels", () => {
    expect(classifyPortfolioCategory("Live Raw")).toBe("Live");
    expect(classifyPortfolioCategory("Prop Firm")).toBe("Prop Firm");
    expect(classifyPortfolioCategory("Demo Standard")).toBe("Demo");
  });

  it("maps synced accounts into portfolio inventory rows", () => {
    const synced = createAccountSyncSeed().accounts[0]!;
    const mapped = mapSyncedAccountToPortfolio(synced, {
      activeAccountId: synced.id,
      pinnedAccountIds: [synced.id],
      allocationOverrides: {},
      defaultAllocation: 33.3
    });
    expect(mapped.isActive).toBe(true);
    expect(mapped.isPinned).toBe(true);
    expect(mapped.portfolioCategory).toBe("Live");
  });

  it("blocks switching for critical offline accounts", () => {
    const synced = createAccountSyncSeed().accounts[2]!;
    expect(evaluateSwitchEligibility(synced).switchable).toBe(false);
  });

  it("builds group summaries and workflow nodes", () => {
    const accounts = createAccountSyncSeed().accounts.map((account, index) =>
      mapSyncedAccountToPortfolio(account, {
        activeAccountId: index === 0 ? account.id : null,
        pinnedAccountIds: [],
        allocationOverrides: {},
        defaultAllocation: 33.3
      })
    );
    expect(buildGroupSummaries(accounts).find((group) => group.category === "All")?.count).toBe(3);
    expect(buildAccountCenterWorkflow(accounts)).toHaveLength(6);
    expect(portfolioHealthScore(accounts)).toBeGreaterThan(0);
  });
});

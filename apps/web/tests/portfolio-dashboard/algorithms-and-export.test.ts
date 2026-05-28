import { beforeEach, describe, expect, it } from "vitest";
import { seedAccountSyncStore } from "@/tests/helpers/seed-api-stores";
import { buildAllocationSlices } from "@/modules/accounts-and-portfolio/portfolio-dashboard/algorithms/portfolio-dashboard.algorithms";
import { buildAccountCenterResponse, exportAccountCenter, resetAccountCenterState } from "@/app/api/accounts-and-portfolio/account-center/_lib/store";
import { buildPortfolioDashboardResponse } from "@/app/api/accounts-and-portfolio/portfolio-dashboard/_lib/store";
import { exportAccountsToCsv } from "@/modules/accounts-and-portfolio/account-center/algorithms/account-center.algorithms";

describe("Portfolio dashboard algorithms", () => {
  beforeEach(() => {
    resetAccountCenterState();
    seedAccountSyncStore();
  });

  it("builds allocation slices with equity share percentages", async () => {
    const source = await buildAccountCenterResponse("Infrastructure Admin");
    const slices = buildAllocationSlices(source.accounts);
    expect(slices.length).toBeGreaterThan(0);
    expect(slices.reduce((sum, slice) => sum + slice.equitySharePercent, 0)).toBeCloseTo(100, 0);
  });

  it("aggregates portfolio dashboard from account center inventory", async () => {
    const dashboard = await buildPortfolioDashboardResponse("Infrastructure Admin");
    expect(dashboard.allocations.length).toBeGreaterThan(0);
    expect(dashboard.kpis.some((kpi) => kpi.label === "Aggregate Equity")).toBe(true);
    expect(dashboard.quickLinks[0]?.label).toBe("Account Center");
  });
});

describe("Account center export", () => {
  beforeEach(() => {
    resetAccountCenterState();
    seedAccountSyncStore();
  });

  it("exports csv inventory with headers", async () => {
    const response = await exportAccountCenter({ format: "csv" }, "Infrastructure Admin");
    expect(response.ok).toBe(true);
    expect(response.message.split("\n")[0]).toContain("accountLogin");
  });

  it("exports json inventory payload", async () => {
    const response = await exportAccountCenter({ format: "json" }, "Infrastructure Admin");
    const parsed = JSON.parse(response.message) as { accounts: unknown[] };
    expect(parsed.accounts.length).toBeGreaterThan(0);
  });

  it("serializes csv rows from accounts", async () => {
    const source = await buildAccountCenterResponse("Infrastructure Admin");
    const csv = exportAccountsToCsv(source.accounts);
    expect(csv).toContain(source.accounts[0]?.accountLogin ?? "");
  });
});

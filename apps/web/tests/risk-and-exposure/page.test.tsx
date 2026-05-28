import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams()
}));

import { RiskAndExposureDashboard } from "@/modules/accounts-and-portfolio/risk-and-exposure/components/risk-and-exposure-dashboard";
import { createAccountSyncSeed } from "@/tests/fixtures/account-sync.fixture";
import { mapSyncedAccountToPortfolio } from "@/modules/accounts-and-portfolio/account-center/algorithms/account-center.algorithms";
import { mapToRiskAndExposureResponse } from "@/modules/accounts-and-portfolio/risk-and-exposure/algorithms/risk-and-exposure.algorithms";
import { installFetchMock, setupDashboardTestEnv, teardownDashboardTestEnv } from "../helpers/dashboard-test-env";

const seed = createAccountSyncSeed();
const timestamp = new Date().toISOString();
const mapped = seed.accounts.map((account) =>
  mapSyncedAccountToPortfolio(account, {
    activeAccountId: seed.accounts[0]!.id,
    pinnedAccountIds: [],
    allocationOverrides: {},
    defaultAllocation: 33.3
  })
);

const payload = mapToRiskAndExposureResponse({
  source: {
    meta: {
      timestamp,
      currentRole: "Infrastructure Admin",
      streamEndpoint: "/api/accounts-and-portfolio/account-center/events-stream",
      monitoringMode: "Autonomous Portfolio Workspace",
      activeAccountId: mapped[0]!.id
    },
    kpis: [],
    workflow: [],
    accounts: mapped,
    groups: [],
    activeAccount: mapped[0]!,
    switchHistory: [],
    quickLinks: [],
    permissions: {
      role: "Infrastructure Admin",
      canSwitch: true,
      canPin: true,
      canExport: true,
      canManageAllocation: true
    },
    audits: []
  },
  synced: seed.accounts,
  exposures: seed.exposures,
  highlightedAccountId: mapped[0]!.id
});

afterEach(() => {
  cleanup();
  teardownDashboardTestEnv();
});

beforeEach(() => {
  setupDashboardTestEnv();
  installFetchMock({
    "/accounts-and-portfolio/risk-and-exposure": () => payload
  });
});

describe("Risk and Exposure dashboard", () => {
  it("renders KPIs and account margin table", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <RiskAndExposureDashboard />
      </QueryClientProvider>
    );

    expect(await screen.findByRole("heading", { name: "Risk & Exposure" })).toBeInTheDocument();
    expect(screen.getByText("Linked Accounts")).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Account margin and leverage" })).toBeInTheDocument();
    expect(screen.getAllByText(mapped[0]!.accountLogin).length).toBeGreaterThan(0);
  });
});

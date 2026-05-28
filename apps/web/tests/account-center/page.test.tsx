import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams()
}));

import { AccountCenterDashboard } from "@/modules/accounts-and-portfolio/account-center/components/account-center-dashboard";
import { createAccountSyncSeed } from "@/tests/fixtures/account-sync.fixture";
import { classifyPortfolioCategory, mapSyncedAccountToPortfolio } from "@/modules/accounts-and-portfolio/account-center/algorithms/account-center.algorithms";
import { installFetchMock, setupDashboardTestEnv, teardownDashboardTestEnv } from "../helpers/dashboard-test-env";

const timestamp = new Date().toISOString();
const synced = createAccountSyncSeed().accounts[0]!;
const account = mapSyncedAccountToPortfolio(synced, {
  activeAccountId: synced.id,
  pinnedAccountIds: [],
  allocationOverrides: {},
  defaultAllocation: 100
});

afterEach(() => {
  cleanup();
  teardownDashboardTestEnv();
});

beforeEach(() => {
  setupDashboardTestEnv();
  installFetchMock({
    "/accounts-and-portfolio/account-center": () => ({
      meta: {
        timestamp,
        currentRole: "Infrastructure Admin",
        streamEndpoint: "/api/accounts-and-portfolio/account-center/events-stream",
        monitoringMode: "Autonomous Portfolio Workspace",
        activeAccountId: account.id
      },
      kpis: [{ label: "Total Accounts", value: "1", status: "Healthy", detail: "Linked accounts", updatedAt: timestamp }],
      workflow: [{ title: "Inventory Aggregated", status: "Healthy", accountCount: 1, blockedCount: 0, detail: "Ready" }],
      accounts: [account],
      groups: [
        { category: "All", count: 1, totalEquity: account.equity, tradingEnabledCount: 1, healthyCount: 1 },
        { category: "Live", count: 1, totalEquity: account.equity, tradingEnabledCount: 1, healthyCount: 1 }
      ],
      activeAccount: account,
      switchHistory: [],
      quickLinks: [],
      permissions: { role: "Infrastructure Admin", canSwitch: true, canPin: true, canExport: true, canManageAllocation: true },
      audits: []
    })
  });
});

describe("Account Center dashboard", () => {
  it("renders inventory and active account context", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <AccountCenterDashboard />
      </QueryClientProvider>
    );

    expect(await screen.findByRole("heading", { name: "Account Center" })).toBeInTheDocument();
    expect(screen.getByText("Account Inventory")).toBeInTheDocument();
    expect(screen.getAllByText(account.accountLogin).length).toBeGreaterThan(0);
    expect(screen.getAllByText(classifyPortfolioCategory(account.accountType)).length).toBeGreaterThan(0);
  });

  it("filters accounts by search term", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <AccountCenterDashboard />
      </QueryClientProvider>
    );

    const table = await screen.findByRole("table", { name: "Account inventory" });
    fireEvent.change(screen.getByLabelText("Search accounts"), { target: { value: "missing-account" } });
    expect(within(table).queryByText(account.accountLogin)).not.toBeInTheDocument();
  });
});

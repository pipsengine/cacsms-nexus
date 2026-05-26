import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { Mt5ErrorLogsDashboard } from "@/modules/mt5-infrastructure-and-broker-connectivity/mt5-error-logs/components/mt5-error-logs-dashboard";
import { useMt5ErrorLogsStore } from "@/modules/mt5-infrastructure-and-broker-connectivity/mt5-error-logs/stores/mt5-error-logs.store";
import { createMt5ErrorLogsSeed } from "@/tests/fixtures/mt5-error-logs.fixture";
import { installFetchMock, setupDashboardTestEnv, teardownDashboardTestEnv } from "../helpers/dashboard-test-env";

const timestamp = new Date().toISOString();
const error = createMt5ErrorLogsSeed().errors[0]!;

afterEach(() => {
  cleanup();
  teardownDashboardTestEnv();
});

beforeEach(() => {
  setupDashboardTestEnv();
  useMt5ErrorLogsStore.setState({ role: "Read-Only Viewer", searchTerm: "", severityFilter: "all", moduleFilter: "all", statusFilter: "all", brokerFilter: "all", selectedErrorId: null, selectedErrorIds: [] });
  installFetchMock({
    "/error-logs/summary": () => ({
      meta: { timestamp, currentRole: "Read-Only Viewer", streamEndpoint: "/api/mt5/error-logs/events-stream" },
      kpis: [],
      aiRiskScore: { score: 0, rating: "Excellent", factors: {} }
    }),
    "/error-logs/workflow": () => ({ meta: { timestamp }, workflow: [] }),
    "/error-logs/categories": () => ({ meta: { timestamp }, categories: [] }),
    "/error-logs/trends": () => ({ meta: { timestamp }, trends: [] }),
    "/error-logs/repeated": () => ({ meta: { timestamp, total: 0 }, fingerprints: [] }),
    "/error-logs/incidents": () => ({ meta: { timestamp, total: 0 }, incidents: [] }),
    "/error-logs/ai-diagnostics": () => ({ meta: { timestamp, total: 0 }, diagnostics: [] }),
    "/error-logs/resolutions": () => ({ meta: { timestamp, total: 0 }, resolutions: [] }),
    "/error-logs/audit": () => ({ meta: { timestamp, total: 0 }, audit: [] }),
    "/error-logs": () => ({ meta: { timestamp, total: 1, page: 1, pageSize: 75 }, errors: [error] })
  });
});

describe("MT5 Error Logs dashboard", () => {
  it("renders sections and protects viewer actions", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <Mt5ErrorLogsDashboard />
      </QueryClientProvider>
    );

    expect(screen.getByRole("heading", { name: "MT5 Error Logs" })).toBeInTheDocument();
    expect(screen.getByText("Error Logs Table")).toBeInTheDocument();
    expect(screen.getByText("AI Error Diagnostics")).toBeInTheDocument();

    expect(screen.getByRole("button", { name: "Sync Latest Errors" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Run Error Diagnostics" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Mark Selected Resolved" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Escalate Critical Errors" })).toBeDisabled();

    expect(await screen.findByRole("button", { name: error.errorId })).toBeInTheDocument();
  }, 15000);

  it("searches the error logs table", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <Mt5ErrorLogsDashboard />
      </QueryClientProvider>
    );

    await screen.findByRole("button", { name: error.errorId });
    fireEvent.change(screen.getByLabelText("Search errors"), { target: { value: error.errorMessage.slice(0, 12) } });
    const table = within(screen.getByRole("table", { name: "Error logs" }));
    const matches = await table.findAllByText(new RegExp(error.errorMessage.slice(0, 12), "i"));
    expect(matches.length).toBeGreaterThan(0);
  }, 15000);
});

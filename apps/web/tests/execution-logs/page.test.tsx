import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ExecutionLogsDashboard } from "@/modules/mt5-infrastructure-and-broker-connectivity/execution-logs/components/execution-logs-dashboard";
import { useExecutionLogsStore } from "@/modules/mt5-infrastructure-and-broker-connectivity/execution-logs/stores/execution-logs.store";
import { createExecutionLogsSeed } from "@/tests/fixtures/execution-logs.fixture";
import { installFetchMock, setupDashboardTestEnv, teardownDashboardTestEnv } from "../helpers/dashboard-test-env";

const timestamp = new Date().toISOString();
const log = createExecutionLogsSeed().logs[0]!;

afterEach(() => {
  cleanup();
  teardownDashboardTestEnv();
});

beforeEach(() => {
  setupDashboardTestEnv();
  useExecutionLogsStore.setState({
    role: "Read-Only Viewer",
    searchTerm: "",
    statusFilter: "all",
    brokerFilter: "all",
    symbolFilter: "all",
    reviewedFilter: "all",
    selectedLogId: null,
    selectedLogIds: []
  } as any);
  installFetchMock({
    "/execution-logs/summary": () => ({
      meta: { timestamp, currentRole: "Read-Only Viewer", streamEndpoint: "/api/mt5/execution-logs/events-stream" },
      kpis: [],
      executionQualityScore: { score: 0, rating: "Critical", factors: {} }
    }),
    "/execution-logs/workflow": () => ({ meta: { timestamp }, workflow: [] }),
    "/execution-logs/quality-analytics": () => ({ meta: { timestamp }, metrics: [] }),
    "/execution-logs/exceptions": () => ({ meta: { timestamp, total: 0 }, exceptions: [] }),
    "/execution-logs/ai-diagnostics": () => ({ meta: { timestamp, total: 0 }, diagnostics: [] }),
    "/execution-logs/audit": () => ({ meta: { timestamp, total: 0 }, audit: [] }),
    "/execution-logs": () => ({ meta: { timestamp, total: 1, page: 1, pageSize: 75 }, logs: [log] })
  });
});

describe("Execution Logs dashboard", () => {
  it("renders sections and protects viewer actions", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <ExecutionLogsDashboard />
      </QueryClientProvider>
    );

    expect(screen.getByRole("heading", { name: "Execution Logs" })).toBeInTheDocument();
    expect(screen.getByText("Execution Logs Table")).toBeInTheDocument();
    expect(screen.getByText("AI Execution Diagnostics")).toBeInTheDocument();

    expect(screen.getByRole("button", { name: "Sync Latest Executions" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Run Execution Diagnostics" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Escalate Failed Executions" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Mark Reviewed" })).toBeDisabled();

    expect(await screen.findByRole("button", { name: log.logId })).toBeInTheDocument();
  }, 15000);

  it("searches the execution logs table", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <ExecutionLogsDashboard />
      </QueryClientProvider>
    );

    await screen.findByRole("button", { name: log.logId });
    fireEvent.change(screen.getByLabelText("Search execution logs"), { target: { value: log.brokerResponseMessage ?? log.broker } });

    const table = within(screen.getByRole("table", { name: "Execution logs" }));
    const matches = await table.findAllByText(new RegExp(log.broker, "i"));
    expect(matches.length).toBeGreaterThan(0);
  }, 15000);
});

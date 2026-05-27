import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { SlippageMonitorDashboard } from "@/modules/mt5-infrastructure-and-broker-connectivity/slippage-monitor/components/slippage-monitor-dashboard";
import { useSlippageMonitorStore } from "@/modules/mt5-infrastructure-and-broker-connectivity/slippage-monitor/stores/slippage-monitor.store";
import { createMockExecutions, createMockThresholds } from "@/tests/fixtures/slippage-monitor.fixture";
import { installFetchMock, setupDashboardTestEnv, teardownDashboardTestEnv } from "../helpers/dashboard-test-env";

const timestamp = new Date().toISOString();
const execution = createMockExecutions(createMockThresholds())[0]!;

afterEach(() => {
  cleanup();
  teardownDashboardTestEnv();
});

beforeEach(() => {
  setupDashboardTestEnv();
  useSlippageMonitorStore.setState({ role: "Read-Only Viewer" });
  installFetchMock({
    "/slippage-monitor/summary": () => ({
      meta: { timestamp, currentRole: "Read-Only Viewer", streamEndpoint: "/api/mt5/slippage-monitor/events-stream" },
      kpis: [],
      slippageRiskScore: { score: 0, rating: "Excellent", factors: {} },
      executionQualityScore: { score: 0, rating: "Excellent", factors: {} }
    }),
    "/slippage-monitor/workflow": () => ({ meta: { timestamp }, workflow: [] }),
    "/slippage-monitor/executions": () => ({ meta: { timestamp, total: 1, page: 1, pageSize: 75 }, executions: [execution] }),
    "/slippage-monitor/broker-comparison": () => ({ meta: { timestamp }, rows: [] }),
    "/slippage-monitor/trends": () => ({ meta: { timestamp }, points: [] }),
    "/slippage-monitor/thresholds": () => ({ meta: { timestamp, total: 0 }, thresholds: [] }),
    "/slippage-monitor/alerts": () => ({ meta: { timestamp, total: 0 }, alerts: [] }),
    "/slippage-monitor/logs": () => ({ meta: { timestamp, total: 0 }, logs: [] }),
    "/slippage-monitor/ai-diagnostics": () => ({ meta: { timestamp, total: 0 }, diagnostics: [] })
  });
});

describe("Slippage Monitor dashboard", () => {
  it("renders sections and protects viewer actions", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <SlippageMonitorDashboard />
      </QueryClientProvider>
    );

    expect(await screen.findByRole("heading", { name: "Slippage Monitor" })).toBeInTheDocument();
    expect(screen.getByText("Slippage Monitor Table")).toBeInTheDocument();
    expect(screen.getByText("AI Slippage Diagnostics")).toBeInTheDocument();

    expect(screen.getByRole("button", { name: "Run Slippage Diagnostics" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Disable Unsafe Execution" })).toBeDisabled();

    expect(await screen.findByRole("button", { name: execution.executionId })).toBeInTheDocument();
  }, 15000);

  it("searches the slippage table", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <SlippageMonitorDashboard />
      </QueryClientProvider>
    );

    await screen.findByRole("button", { name: execution.executionId });
    fireEvent.change(screen.getByLabelText("Search executions"), { target: { value: execution.broker } });

    const table = within(screen.getByRole("table", { name: "Slippage executions" }));
    expect((await table.findAllByText(execution.broker)).length).toBeGreaterThan(0);
  }, 15000);
});

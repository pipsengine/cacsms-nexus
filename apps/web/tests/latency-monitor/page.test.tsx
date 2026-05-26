import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { LatencyMonitorDashboard } from "@/modules/mt5-infrastructure-and-broker-connectivity/latency-monitor/components/latency-monitor-dashboard";
import { useLatencyMonitorStore } from "@/modules/mt5-infrastructure-and-broker-connectivity/latency-monitor/stores/latency-monitor.store";
import { createLatencyMonitorSeed } from "@/tests/fixtures/latency-monitor.fixture";
import { installFetchMock, setupDashboardTestEnv, teardownDashboardTestEnv } from "../helpers/dashboard-test-env";

const timestamp = new Date().toISOString();
const metric = createLatencyMonitorSeed().metrics[0]!;

afterEach(() => {
  cleanup();
  teardownDashboardTestEnv();
});

beforeEach(() => {
  setupDashboardTestEnv();
  useLatencyMonitorStore.setState({ role: "Read-Only Viewer" });
  installFetchMock({
    "/latency-monitor/summary": () => ({
      meta: { timestamp, currentRole: "Read-Only Viewer", streamEndpoint: "/api/mt5/latency-monitor/events-stream" },
      kpis: [],
      latencyRiskScore: { score: 0, rating: "Excellent", factors: {} }
    }),
    "/latency-monitor/workflow": () => ({ meta: { timestamp }, workflow: [] }),
    "/latency-monitor/metrics": () => ({ meta: { timestamp, total: 1, page: 1, pageSize: 75 }, metrics: [metric] }),
    "/latency-monitor/broker-comparison": () => ({ meta: { timestamp }, rows: [] }),
    "/latency-monitor/trends": () => ({ meta: { timestamp }, points: [] }),
    "/latency-monitor/thresholds": () => ({ meta: { timestamp, total: 0 }, thresholds: [] }),
    "/latency-monitor/alerts": () => ({ meta: { timestamp, total: 0 }, alerts: [] }),
    "/latency-monitor/logs": () => ({ meta: { timestamp, total: 0 }, logs: [] }),
    "/latency-monitor/ai-diagnostics": () => ({ meta: { timestamp, total: 0 }, diagnostics: [] })
  });
});

describe("Latency Monitor dashboard", () => {
  it("renders sections and protects viewer actions", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <LatencyMonitorDashboard />
      </QueryClientProvider>
    );

    expect(screen.getByRole("heading", { name: "Latency Monitor" })).toBeInTheDocument();
    expect(screen.getByText("Latency Monitor Table")).toBeInTheDocument();
    expect(screen.getByText("AI Latency Diagnostics")).toBeInTheDocument();

    expect(screen.getByRole("button", { name: "Run Latency Diagnostics" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Test Broker Ping" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Disable High-Latency Routes" })).toBeDisabled();

    expect(await screen.findByRole("button", { name: metric.metricId })).toBeInTheDocument();
  }, 15000);

  it("searches the latency metrics table", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <LatencyMonitorDashboard />
      </QueryClientProvider>
    );

    await screen.findByRole("button", { name: metric.metricId });
    fireEvent.change(screen.getByLabelText("Search metrics"), { target: { value: metric.broker } });

    const table = within(screen.getByRole("table", { name: "Latency metrics" }));
    expect((await table.findAllByText(metric.broker)).length).toBeGreaterThan(0);
  }, 15000);
});

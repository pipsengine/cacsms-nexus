import { createSpreadMonitorSeed } from "@/tests/fixtures/spread-monitor.fixture";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { SpreadMonitorDashboard } from "@/modules/mt5-infrastructure-and-broker-connectivity/spread-monitor/components/spread-monitor-dashboard";
import { useSpreadMonitorStore } from "@/modules/mt5-infrastructure-and-broker-connectivity/spread-monitor/stores/spread-monitor.store";
import { installFetchMock, setupDashboardTestEnv, teardownDashboardTestEnv } from "../helpers/dashboard-test-env";

const timestamp = new Date().toISOString();
const spread = createSpreadMonitorSeed().spreads[0]!;

afterEach(() => {
  cleanup();
  teardownDashboardTestEnv();
});

beforeEach(() => {
  setupDashboardTestEnv();
  useSpreadMonitorStore.setState({ role: "Read-Only Viewer" });
  installFetchMock({
    "/spread-monitor/summary": () => ({
      meta: { timestamp, currentRole: "Read-Only Viewer", streamEndpoint: "/api/mt5/spread-monitor/events-stream" },
      kpis: [],
      spreadRiskScore: { score: 0, rating: "Excellent", factors: {} }
    }),
    "/spread-monitor/spreads": () => ({ meta: { timestamp, total: 1, page: 1, pageSize: 75 }, spreads: [spread] }),
    "/spread-monitor/broker-comparison": () => ({ meta: { timestamp }, rows: [] }),
    "/spread-monitor/trends": () => ({ meta: { timestamp }, points: [] }),
    "/spread-monitor/thresholds": () => ({ meta: { timestamp, total: 0 }, thresholds: [] }),
    "/spread-monitor/alerts": () => ({ meta: { timestamp, total: 0 }, alerts: [] }),
    "/spread-monitor/logs": () => ({ meta: { timestamp, total: 0 }, logs: [] }),
    "/spread-monitor/ai-diagnostics": () => ({ meta: { timestamp, total: 0 }, diagnostics: [] })
  });
});

describe("Spread Monitor dashboard", () => {
  it("renders sections and protects viewer actions", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <SpreadMonitorDashboard />
      </QueryClientProvider>
    );

    expect(screen.getByRole("heading", { name: "Spread Monitor" })).toBeInTheDocument();
    expect(screen.getByText("Spread Monitor Table")).toBeInTheDocument();
    expect(screen.getByText("AI Spread Diagnostics")).toBeInTheDocument();

    expect(screen.getByRole("button", { name: "Run Spread Diagnostics" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Disable Unsafe Symbols" })).toBeDisabled();

    expect((await screen.findAllByRole("button", { name: spread.symbol })).length).toBeGreaterThan(0);
  }, 15000);

  it("searches the spread monitor table", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <SpreadMonitorDashboard />
      </QueryClientProvider>
    );

    await screen.findAllByRole("button", { name: spread.symbol });
    fireEvent.change(screen.getByLabelText("Search spreads"), { target: { value: spread.broker } });

    const table = within(screen.getByRole("table", { name: "Spread monitor table" }));
    expect((await table.findAllByText(spread.broker)).length).toBeGreaterThan(0);
  }, 15000);
});

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { EaMonitoringDashboard } from "@/modules/mt5-infrastructure-and-broker-connectivity/ea-monitoring/components/ea-monitoring-dashboard";
import { useEaMonitoringStore } from "@/modules/mt5-infrastructure-and-broker-connectivity/ea-monitoring/stores/ea-monitoring.store";
import { installFetchMock, setupDashboardTestEnv, teardownDashboardTestEnv } from "../helpers/dashboard-test-env";

const timestamp = new Date().toISOString();
const instance = {
  id: "ea-1",
  eaId: "EA-1000",
  eaName: "NexusBridgeEA",
  eaVersion: "1.0.0",
  buildNumber: "100",
  terminal: "MT5-Terminal-1",
  broker: "IC Markets",
  accountLogin: "73018421",
  strategyId: null,
  strategyName: null,
  strategyVersion: null,
  symbolScope: ["EURUSD"],
  timeframeScope: ["M15"],
  connectionStatus: "Online",
  heartbeatStatus: "Active",
  bridgeStatus: "Connected",
  commandChannelStatus: "Ready",
  executionFeedbackStatus: "Ready",
  tradingEnabled: true,
  emergencyStopActive: false,
  riskRulesLoaded: true,
  accountTradingAllowed: true,
  symbolTradingAllowed: true,
  commandSuccessRate: 100,
  failedCommands: 0,
  averageLatencyMs: 120,
  lastError: null,
  riskLevel: "Low",
  healthScore: 90,
  readiness: { executionReady: true, blockers: [] },
  updatedAt: timestamp,
  createdAt: timestamp
};

afterEach(() => {
  cleanup();
  teardownDashboardTestEnv();
});

beforeEach(() => {
  setupDashboardTestEnv();
  useEaMonitoringStore.setState({
    role: "Read-Only Viewer",
    searchTerm: "",
    statusFilter: "all",
    riskFilter: "all",
    tradingFilter: "all",
    selectedEaId: null,
    selectedEaIds: [],
    showDetailPanel: true,
    logsFilter: "All"
  } as any);
  installFetchMock({
    "/ea-monitoring/summary": () => ({
      meta: { timestamp, currentRole: "Read-Only Viewer", streamEndpoint: "/api/mt5/ea-monitoring/events-stream" },
      kpis: [],
      eaHealthScore: { score: 0, rating: "Critical", factors: {} }
    }),
    "/ea-monitoring/workflow": () => ({ meta: { timestamp }, workflow: [] }),
    "/ea-monitoring/instances": () => ({ meta: { timestamp, total: 1, page: 1, pageSize: 75 }, instances: [instance] }),
    "/ea-monitoring/commands": () => ({ meta: { timestamp, total: 0 }, commands: [] }),
    "/ea-monitoring/strategy-bindings": () => ({ meta: { timestamp, total: 0 }, bindings: [] }),
    "/ea-monitoring/logs": () => ({ meta: { timestamp, total: 0 }, logs: [] }),
    "/ea-monitoring/exceptions": () => ({ meta: { timestamp, total: 0 }, exceptions: [] }),
    "/ea-monitoring/analytics": () => ({ meta: { timestamp, total: 0 }, points: [] }),
    "/ea-monitoring/ai-diagnostics": () => ({ meta: { timestamp, total: 0 }, diagnostics: [] }),
    "/ea-monitoring/audit": () => ({ meta: { timestamp, total: 0 }, audit: [] })
  });
});

describe("EA Monitoring dashboard", () => {
  it("renders sections and protects viewer actions", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <EaMonitoringDashboard />
      </QueryClientProvider>
    );

    expect(screen.getByRole("heading", { name: "EA Monitoring" })).toBeInTheDocument();
    expect(screen.getByText("EA Instances Table")).toBeInTheDocument();
    expect(screen.getByText("EA Monitoring Workflow")).toBeInTheDocument();

    expect(screen.getByRole("button", { name: "Sync EA Status" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Run EA Diagnostics" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Restart EA Session" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Disable EA Trading" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Enable EA Trading" })).toBeDisabled();

    expect(await screen.findByRole("button", { name: "EA-1000" })).toBeInTheDocument();
  }, 15000);

  it("searches the EA instances table", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <EaMonitoringDashboard />
      </QueryClientProvider>
    );

    await screen.findByRole("button", { name: "EA-1000" });
    fireEvent.change(screen.getByLabelText("Search EAs"), { target: { value: "NexusBridgeEA" } });

    const table = within(screen.getByRole("table", { name: "EA instances" }));
    const matches = await table.findAllByText(/nexusbridgeea/i);
    expect(matches.length).toBeGreaterThan(0);
  }, 15000);
});

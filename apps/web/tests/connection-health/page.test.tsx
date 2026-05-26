import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ConnectionHealthDashboard } from "@/modules/mt5-infrastructure-and-broker-connectivity/connection-health/components/connection-health-dashboard";
import { useConnectionHealthStore } from "@/modules/mt5-infrastructure-and-broker-connectivity/connection-health/stores/connection-health.store";
import { createMockComponents } from "@/tests/fixtures/connection-health.fixture";
import { installFetchMock, setupDashboardTestEnv, teardownDashboardTestEnv } from "../helpers/dashboard-test-env";

const timestamp = new Date().toISOString();
const component = createMockComponents()[0]!;

afterEach(() => {
  cleanup();
  teardownDashboardTestEnv();
});

beforeEach(() => {
  setupDashboardTestEnv();
  useConnectionHealthStore.setState({ role: "Read-Only Viewer" });
  installFetchMock({
    "/connection-health/summary": () => ({
      meta: { timestamp, currentRole: "Read-Only Viewer", streamEndpoint: "/api/mt5/connection-health/events-stream" },
      overallHealth: { score: 0, rating: "Critical", factors: {} },
      infrastructureRiskLevel: "Low",
      kpis: []
    }),
    "/connection-health/components": () => ({ meta: { timestamp, total: 1, page: 1, pageSize: 60 }, components: [component] }),
    "/connection-health/workflow": () => ({ meta: { timestamp }, workflow: [] }),
    "/connection-health/dependency-map": () => ({
      meta: { timestamp },
      nodes: [],
      edges: [],
      firstFailedComponentId: null,
      downstreamImpactedComponentIds: [],
      tradingImpact: "",
      recommendedRecoverySequence: []
    }),
    "/connection-health/latency": () => ({ meta: { timestamp }, points: [] }),
    "/connection-health/packet-loss": () => ({ meta: { timestamp }, points: [] }),
    "/connection-health/heartbeats": () => ({ meta: { timestamp, total: 0 }, heartbeats: [] }),
    "/connection-health/incidents": () => ({ meta: { timestamp, total: 0 }, incidents: [] }),
    "/connection-health/logs": () => ({ meta: { timestamp, total: 0 }, logs: [] }),
    "/connection-health/ai-diagnostics": () => ({ meta: { timestamp }, diagnostics: [] })
  });
});

describe("Connection Health dashboard", () => {
  it("renders command sections and protects viewer actions", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <ConnectionHealthDashboard />
      </QueryClientProvider>
    );

    expect(screen.getByRole("heading", { name: "Connection Health" })).toBeInTheDocument();
    expect(screen.getByText("End-to-End Connection Workflow")).toBeInTheDocument();
    expect(screen.getByText("Connection Components Table")).toBeInTheDocument();
    expect(screen.getByText("Connection Incidents & Logs")).toBeInTheDocument();
    expect(screen.getByText("AI Connection Diagnostics")).toBeInTheDocument();

    expect(screen.getByRole("button", { name: "Run Full Diagnostics" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Reconnect Failed Services" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Disable Unsafe Trading" })).toBeDisabled();

    expect(await screen.findByText(component.componentId)).toBeInTheDocument();
  }, 15000);

  it("searches the connection components table", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <ConnectionHealthDashboard />
      </QueryClientProvider>
    );

    await screen.findByText(component.componentId);
    fireEvent.change(screen.getByLabelText("Search components"), { target: { value: component.broker ?? "" } });

    const table = within(screen.getByRole("table", { name: "Connection components" }));
    expect((await table.findAllByText(component.broker ?? "")).length).toBeGreaterThan(0);
  }, 15000);
});

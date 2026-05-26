import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { EaMonitoringDashboard } from "@/modules/mt5-infrastructure-and-broker-connectivity/ea-monitoring/components/ea-monitoring-dashboard";
import { useEaMonitoringStore } from "@/modules/mt5-infrastructure-and-broker-connectivity/ea-monitoring/stores/ea-monitoring.store";

afterEach(cleanup);

beforeEach(() => {
  if (!(globalThis as any).ResizeObserver) {
    (globalThis as any).ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }

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

  window.history.pushState({}, "", "/mt5-infrastructure-and-broker-connectivity/ea-monitoring?mock=1");
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


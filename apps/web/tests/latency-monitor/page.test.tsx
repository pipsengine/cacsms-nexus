import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { LatencyMonitorDashboard } from "@/modules/mt5-infrastructure-and-broker-connectivity/latency-monitor/components/latency-monitor-dashboard";
import { useLatencyMonitorStore } from "@/modules/mt5-infrastructure-and-broker-connectivity/latency-monitor/stores/latency-monitor.store";

afterEach(cleanup);

beforeEach(() => {
  if (!(globalThis as any).ResizeObserver) {
    (globalThis as any).ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  useLatencyMonitorStore.setState({ role: "Read-Only Viewer" });
  window.history.pushState({}, "", "/mt5-infrastructure-and-broker-connectivity/latency-monitor?mock=1");
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

    expect(await screen.findByRole("button", { name: "metric-001" })).toBeInTheDocument();
  }, 15000);

  it("searches the latency metrics table", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <LatencyMonitorDashboard />
      </QueryClientProvider>
    );

    await screen.findByRole("button", { name: "metric-001" });
    fireEvent.change(screen.getByLabelText("Search metrics"), { target: { value: "IC Markets" } });

    const table = within(screen.getByRole("table", { name: "Latency metrics" }));
    expect((await table.findAllByText("IC Markets")).length).toBeGreaterThan(0);
  }, 15000);
});


import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { SpreadMonitorDashboard } from "@/modules/mt5-infrastructure-and-broker-connectivity/spread-monitor/components/spread-monitor-dashboard";
import { useSpreadMonitorStore } from "@/modules/mt5-infrastructure-and-broker-connectivity/spread-monitor/stores/spread-monitor.store";

afterEach(cleanup);

beforeEach(() => {
  if (!(globalThis as any).ResizeObserver) {
    (globalThis as any).ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  useSpreadMonitorStore.setState({ role: "Read-Only Viewer" });
  window.history.pushState({}, "", "/mt5-infrastructure-and-broker-connectivity/spread-monitor?mock=1");
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

    expect((await screen.findAllByRole("button", { name: "EURUSD" })).length).toBeGreaterThan(0);
  }, 15000);

  it("searches the spread monitor table", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <SpreadMonitorDashboard />
      </QueryClientProvider>
    );

    await screen.findAllByRole("button", { name: "EURUSD" });
    fireEvent.change(screen.getByLabelText("Search spreads"), { target: { value: "IC Markets" } });

    const table = within(screen.getByRole("table", { name: "Spread monitor table" }));
    expect((await table.findAllByText("IC Markets")).length).toBeGreaterThan(0);
  }, 15000);
});

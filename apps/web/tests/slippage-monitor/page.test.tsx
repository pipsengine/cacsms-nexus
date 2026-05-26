import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { SlippageMonitorDashboard } from "@/modules/mt5-infrastructure-and-broker-connectivity/slippage-monitor/components/slippage-monitor-dashboard";
import { useSlippageMonitorStore } from "@/modules/mt5-infrastructure-and-broker-connectivity/slippage-monitor/stores/slippage-monitor.store";

afterEach(cleanup);

beforeEach(() => {
  if (!(globalThis as any).ResizeObserver) {
    (globalThis as any).ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  useSlippageMonitorStore.setState({ role: "Read-Only Viewer" });
  window.history.pushState({}, "", "/mt5-infrastructure-and-broker-connectivity/slippage-monitor?mock=1");
});

describe("Slippage Monitor dashboard", () => {
  it("renders sections and protects viewer actions", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <SlippageMonitorDashboard />
      </QueryClientProvider>
    );

    expect(screen.getByRole("heading", { name: "Slippage Monitor" })).toBeInTheDocument();
    expect(screen.getByText("Slippage Monitor Table")).toBeInTheDocument();
    expect(screen.getByText("AI Slippage Diagnostics")).toBeInTheDocument();

    expect(screen.getByRole("button", { name: "Run Slippage Diagnostics" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Disable Unsafe Execution" })).toBeDisabled();

    expect(await screen.findByRole("button", { name: "execution-001" })).toBeInTheDocument();
  }, 15000);

  it("searches the slippage table", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <SlippageMonitorDashboard />
      </QueryClientProvider>
    );

    await screen.findByRole("button", { name: "execution-001" });
    fireEvent.change(screen.getByLabelText("Search executions"), { target: { value: "IC Markets" } });

    const table = within(screen.getByRole("table", { name: "Slippage executions" }));
    expect((await table.findAllByText("IC Markets")).length).toBeGreaterThan(0);
  }, 15000);
});

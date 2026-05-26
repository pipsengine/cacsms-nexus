import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { Mt5ErrorLogsDashboard } from "@/modules/mt5-infrastructure-and-broker-connectivity/mt5-error-logs/components/mt5-error-logs-dashboard";
import { useMt5ErrorLogsStore } from "@/modules/mt5-infrastructure-and-broker-connectivity/mt5-error-logs/stores/mt5-error-logs.store";

afterEach(cleanup);

beforeEach(() => {
  if (!(globalThis as any).ResizeObserver) {
    (globalThis as any).ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  useMt5ErrorLogsStore.setState({ role: "Read-Only Viewer", searchTerm: "", severityFilter: "all", moduleFilter: "all", statusFilter: "all", brokerFilter: "all", selectedErrorId: null, selectedErrorIds: [] });
  window.history.pushState({}, "", "/mt5-infrastructure-and-broker-connectivity/mt5-error-logs?mock=1");
});

describe("MT5 Error Logs dashboard", () => {
  it("renders sections and protects viewer actions", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <Mt5ErrorLogsDashboard />
      </QueryClientProvider>
    );

    expect(screen.getByRole("heading", { name: "MT5 Error Logs" })).toBeInTheDocument();
    expect(screen.getByText("Error Logs Table")).toBeInTheDocument();
    expect(screen.getByText("AI Error Diagnostics")).toBeInTheDocument();

    expect(screen.getByRole("button", { name: "Sync Latest Errors" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Run Error Diagnostics" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Mark Selected Resolved" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Escalate Critical Errors" })).toBeDisabled();

    expect(await screen.findByRole("button", { name: "ERR-1000" })).toBeInTheDocument();
  }, 15000);

  it("searches the error logs table", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <Mt5ErrorLogsDashboard />
      </QueryClientProvider>
    );

    await screen.findByRole("button", { name: "ERR-1000" });

    fireEvent.change(screen.getByLabelText("Search errors"), { target: { value: "broker socket reset" } });
    const table = within(screen.getByRole("table", { name: "Error logs" }));
    const matches = await table.findAllByText(/broker socket reset/i);
    expect(matches.length).toBeGreaterThan(0);
  }, 15000);
});

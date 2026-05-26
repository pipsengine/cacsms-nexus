import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ExecutionLogsDashboard } from "@/modules/mt5-infrastructure-and-broker-connectivity/execution-logs/components/execution-logs-dashboard";
import { useExecutionLogsStore } from "@/modules/mt5-infrastructure-and-broker-connectivity/execution-logs/stores/execution-logs.store";

afterEach(cleanup);

beforeEach(() => {
  if (!(globalThis as any).ResizeObserver) {
    (globalThis as any).ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  useExecutionLogsStore.setState({
    role: "Read-Only Viewer",
    searchTerm: "",
    statusFilter: "all",
    brokerFilter: "all",
    symbolFilter: "all",
    reviewedFilter: "all",
    selectedLogId: null,
    selectedLogIds: []
  } as any);
  window.history.pushState({}, "", "/mt5-infrastructure-and-broker-connectivity/execution-logs?mock=1");
});

describe("Execution Logs dashboard", () => {
  it("renders sections and protects viewer actions", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <ExecutionLogsDashboard />
      </QueryClientProvider>
    );

    expect(screen.getByRole("heading", { name: "Execution Logs" })).toBeInTheDocument();
    expect(screen.getByText("Execution Logs Table")).toBeInTheDocument();
    expect(screen.getByText("AI Execution Diagnostics")).toBeInTheDocument();

    expect(screen.getByRole("button", { name: "Sync Latest Executions" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Run Execution Diagnostics" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Escalate Failed Executions" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Mark Reviewed" })).toBeDisabled();

    expect(await screen.findByRole("button", { name: "LOG-1200" })).toBeInTheDocument();
  }, 15000);

  it("searches the execution logs table", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <ExecutionLogsDashboard />
      </QueryClientProvider>
    );

    await screen.findByRole("button", { name: "LOG-1200" });
    fireEvent.change(screen.getByLabelText("Search execution logs"), { target: { value: "Insufficient margin" } });

    const table = within(screen.getByRole("table", { name: "Execution logs" }));
    const matches = await table.findAllByText(/insufficient margin/i);
    expect(matches.length).toBeGreaterThan(0);
  }, 15000);
});


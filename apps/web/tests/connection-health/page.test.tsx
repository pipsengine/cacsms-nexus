import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ConnectionHealthDashboard } from "@/modules/mt5-infrastructure-and-broker-connectivity/connection-health/components/connection-health-dashboard";
import { useConnectionHealthStore } from "@/modules/mt5-infrastructure-and-broker-connectivity/connection-health/stores/connection-health.store";

afterEach(cleanup);

beforeEach(() => {
  if (!(globalThis as any).ResizeObserver) {
    (globalThis as any).ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  useConnectionHealthStore.setState({ role: "Read-Only Viewer" });
  window.history.pushState({}, "", "/mt5-infrastructure-and-broker-connectivity/connection-health?mock=1");
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

    expect(await screen.findByRole("button", { name: "term-01" })).toBeInTheDocument();
  });

  it("searches the connection components table", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <ConnectionHealthDashboard />
      </QueryClientProvider>
    );

    await screen.findByRole("button", { name: "term-01" });
    fireEvent.change(screen.getByLabelText("Search components"), { target: { value: "IC Markets" } });

    const table = within(screen.getByRole("table", { name: "Connection components" }));
    expect((await table.findAllByText("IC Markets")).length).toBeGreaterThan(0);
  });
});

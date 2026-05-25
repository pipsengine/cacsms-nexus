import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ExecutionQueueDashboard } from "@/modules/mt5-infrastructure-and-broker-connectivity/execution-queue/components/execution-queue-dashboard";
import { useExecutionQueueStore } from "@/modules/mt5-infrastructure-and-broker-connectivity/execution-queue/stores/execution-queue.store";

afterEach(cleanup);

beforeEach(() => {
  if (!(globalThis as any).ResizeObserver) {
    (globalThis as any).ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  useExecutionQueueStore.setState({ role: "Read-Only Viewer" });
  window.history.pushState({}, "", "/mt5-infrastructure-and-broker-connectivity/execution-queue?mock=1");
});

describe("Execution Queue dashboard", () => {
  it("renders command center sections and protects viewer actions", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <ExecutionQueueDashboard />
      </QueryClientProvider>
    );

    expect(screen.getByRole("heading", { name: "Execution Queue" })).toBeInTheDocument();
    expect(screen.getByText("Execution Queue Workflow")).toBeInTheDocument();
    expect(screen.getByText("Execution Queue Table")).toBeInTheDocument();
    expect(screen.getByText("Queue Priority & SLA Monitor")).toBeInTheDocument();
    expect(screen.getByText("Queue Bottleneck Analysis")).toBeInTheDocument();
    expect(screen.getByText("Execution Feedback Panel")).toBeInTheDocument();
    expect(screen.getByText("AI Execution Queue Diagnostics")).toBeInTheDocument();

    expect(screen.getByRole("button", { name: /Process Queue/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Pause Execution Queue/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Emergency Stop Execution/i })).toBeDisabled();

    expect(await screen.findByText("queue-001")).toBeInTheDocument();
  });

  it("searches the execution queue table", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <ExecutionQueueDashboard />
      </QueryClientProvider>
    );

    await screen.findByText("queue-001");
    fireEvent.change(screen.getByLabelText("Search execution queue"), { target: { value: "IC Markets" } });

    const table = within(screen.getByRole("table", { name: "Execution queue items" }));
    expect((await table.findAllByText("IC Markets")).length).toBeGreaterThan(0);
  });
});

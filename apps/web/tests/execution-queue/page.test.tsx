import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ExecutionQueueDashboard } from "@/modules/mt5-infrastructure-and-broker-connectivity/execution-queue/components/execution-queue-dashboard";
import { useExecutionQueueStore } from "@/modules/mt5-infrastructure-and-broker-connectivity/execution-queue/stores/execution-queue.store";
import { createExecutionQueueSeed } from "@/tests/fixtures/execution-queue.fixture";
import { installFetchMock, setupDashboardTestEnv, teardownDashboardTestEnv } from "../helpers/dashboard-test-env";

const timestamp = new Date().toISOString();
const item = createExecutionQueueSeed().items[0]!;

afterEach(() => {
  cleanup();
  teardownDashboardTestEnv();
});

beforeEach(() => {
  setupDashboardTestEnv();
  useExecutionQueueStore.setState({ role: "Read-Only Viewer" });
  installFetchMock({
    "/execution-queue/summary": () => ({
      meta: { timestamp, currentRole: "Read-Only Viewer", queuePaused: false, emergencyStopActive: false },
      kpis: [],
      health: { score: 0, rating: "Critical", factors: {} },
      workflow: []
    }),
    "/execution-queue/items": () => ({ meta: { timestamp, total: 1, page: 1, pageSize: 75 }, items: [item] }),
    "/execution-queue/priority-sla": () => ({ meta: { timestamp }, rows: [] }),
    "/execution-queue/bottlenecks": () => ({ meta: { timestamp }, bottlenecks: [] }),
    "/execution-queue/exceptions": () => ({ meta: { timestamp, total: 0 }, exceptions: [] }),
    "/execution-queue/execution-feedback": () => ({ meta: { timestamp, total: 0 }, feedback: [] }),
    "/execution-queue/logs": () => ({ meta: { timestamp, total: 0 }, logs: [] }),
    "/execution-queue/ai-diagnostics": () => ({ meta: { timestamp, total: 0 }, diagnostics: [] })
  });
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

    expect(await screen.findByText(item.queueId)).toBeInTheDocument();
  }, 15000);

  it("searches the execution queue table", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <ExecutionQueueDashboard />
      </QueryClientProvider>
    );

    await screen.findByText(item.queueId);
    fireEvent.change(screen.getByLabelText("Search execution queue"), { target: { value: item.broker } });

    const table = within(screen.getByRole("table", { name: "Execution queue items" }));
    expect((await table.findAllByText(item.broker)).length).toBeGreaterThan(0);
  }, 15000);
});

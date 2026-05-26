import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BrokerConnectionsDashboard } from "@/modules/mt5-infrastructure-and-broker-connectivity/broker-connections/components/broker-connections-dashboard";

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  BarChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  LineChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Bar: () => null,
  Line: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null
}));

vi.mock("@/modules/mt5-infrastructure-and-broker-connectivity/broker-connections/hooks/use-broker-connections", async () => {
  const { buildBrokerConnectionsResponse } = await import("@/app/api/mt5/broker-connections/_lib/store");
  const { seedBrokerConnectionsStore } = await import("@/tests/helpers/seed-api-stores");
  seedBrokerConnectionsStore();
  return {
    useBrokerConnections: () => ({
      data: buildBrokerConnectionsResponse("Read-Only Viewer"),
      isLoading: false,
      isError: false,
      streamConnected: true,
      refetch: vi.fn(),
      action: { mutateAsync: vi.fn(), isPending: false }
    })
  };
});

afterEach(cleanup);

describe("Broker Connections dashboard", () => {
  it("renders operational monitoring and restricts protected viewer actions", () => {
    render(<BrokerConnectionsDashboard />);
    expect(screen.getByRole("heading", { name: "Broker Connections" })).toBeInTheDocument();
    expect(screen.getByText("Broker Reliability Ranking")).toBeInTheDocument();
    expect(screen.getByText("AI Broker Diagnostics")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Reconnect Broker/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Disable Broker Execution/i })).toBeDisabled();
  });

  it("filters the scroll-safe broker registry", () => {
    render(<BrokerConnectionsDashboard />);
    fireEvent.change(screen.getByLabelText("Search brokers"), { target: { value: "IC Markets" } });
    const registry = within(screen.getByRole("table", { name: "Broker connections registry" }));
    expect(registry.getByText("IC Markets")).toBeInTheDocument();
    expect(registry.queryByText("FTMO")).not.toBeInTheDocument();
  });
});

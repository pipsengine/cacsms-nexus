import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TerminalStatusDashboard } from "@/modules/mt5-infrastructure-and-broker-connectivity/terminal-status/components/terminal-status-dashboard";

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

vi.mock("@/modules/mt5-infrastructure-and-broker-connectivity/terminal-status/hooks/use-terminal-status", async () => {
  const { buildTerminalStatusResponse } = await import("@/app/api/mt5/terminal-status/_lib/store");
  const { seedTerminalStatusStore } = await import("@/tests/helpers/seed-api-stores");
  seedTerminalStatusStore();
  return {
    useTerminalStatus: () => ({
      data: buildTerminalStatusResponse("Read-Only Viewer"),
      isLoading: false,
      isError: false,
      streamConnected: true,
      refetch: vi.fn(),
      action: { mutateAsync: vi.fn(), isPending: false }
    })
  };
});

afterEach(cleanup);

describe("Terminal Status dashboard", () => {
  it("renders operational sections and protects viewer actions", () => {
    render(<TerminalStatusDashboard />);
    expect(screen.getByRole("heading", { name: "Terminal Status" })).toBeInTheDocument();
    expect(screen.getByText("Terminal Inventory & Operations")).toBeInTheDocument();
    expect(screen.getByText("Heartbeat Monitor")).toBeInTheDocument();
    expect(screen.getByText("AI Terminal Diagnostics")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Restart Selected/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Emergency Disable Terminal Trading/i })).toBeDisabled();
  });

  it("filters terminal rows using search", () => {
    render(<TerminalStatusDashboard />);
    fireEvent.change(screen.getByLabelText("Search terminals"), { target: { value: "MT5-Live-01" } });
    const inventory = within(screen.getByRole("table", { name: "Terminal status inventory" }));
    expect(inventory.getByText("MT5-Live-01")).toBeInTheDocument();
    expect(inventory.queryByText("MT5-Failover-02")).not.toBeInTheDocument();
  });
});

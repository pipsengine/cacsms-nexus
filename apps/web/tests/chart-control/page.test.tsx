import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildChartControlResponse } from "@/app/api/mt5/chart-control/_lib/store";
import { ChartControlDashboard } from "@/modules/mt5-infrastructure-and-broker-connectivity/chart-control/components/chart-control-dashboard";

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ComposedChart: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AreaChart: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  BarChart: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CartesianGrid: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  Tooltip: () => <div />,
  Area: () => <div />,
  Bar: () => <div />,
  Line: () => <div />,
  ReferenceLine: () => <div />
}));
vi.mock("@/modules/mt5-infrastructure-and-broker-connectivity/chart-control/hooks/use-chart-control", () => ({
  useChartControl: () => ({ data: buildChartControlResponse("Read-Only Viewer"), isLoading: false, isError: false, streamConnected: true, refetch: vi.fn(), action: { mutateAsync: vi.fn(), isPending: false } })
}));
afterEach(cleanup);

describe("Chart Control dashboard", () => {
  it("renders workspace panels and protects viewer configuration actions", () => {
    render(<ChartControlDashboard />);
    expect(screen.getByRole("heading", { name: "Chart Control" })).toBeInTheDocument();
    expect(screen.getByText("Primary Chart Canvas")).toBeInTheDocument();
    expect(screen.getByText("Workspace Layouts")).toBeInTheDocument();
    expect(screen.getByText("Chart Signals & AI Review")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Refresh Feeds/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Capture Snapshot/i })).toBeDisabled();
  });

  it("switches selected chart context and filters signal review", () => {
    render(<ChartControlDashboard />);
    fireEvent.click(screen.getByRole("button", { name: "Select XAUUSD chart" }));
    expect(screen.getByText("Gold Spot / US Dollar / IC Markets")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Critical" }));
    const table = within(screen.getByRole("table", { name: "Chart signal review" }));
    expect(table.getByText("NAS100")).toBeInTheDocument();
    expect(table.queryByText("XAUUSD")).not.toBeInTheDocument();
  });
});

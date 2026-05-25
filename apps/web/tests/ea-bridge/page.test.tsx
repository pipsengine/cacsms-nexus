import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { buildEaBridgeResponse } from "@/app/api/mt5/ea-bridge/_lib/store";
import { EaBridgeDashboard } from "@/modules/mt5-infrastructure-and-broker-connectivity/ea-bridge/components/ea-bridge-dashboard";

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  BarChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null
}));

vi.mock("@/modules/mt5-infrastructure-and-broker-connectivity/ea-bridge/hooks/use-ea-bridge", () => ({
  useEaBridge: () => ({
    data: buildEaBridgeResponse("Read-Only Viewer"),
    isLoading: false,
    isError: false,
    streamConnected: true,
    refetch: vi.fn(),
    action: { mutateAsync: vi.fn(), isPending: false }
  })
}));

afterEach(cleanup);

describe("EA Bridge dashboard", () => {
  it("renders bridge operations and disables protected actions for viewers", () => {
    render(<EaBridgeDashboard />);
    expect(screen.getByRole("heading", { name: "EA Bridge" })).toBeInTheDocument();
    expect(screen.getByText("EA Instance Registry")).toBeInTheDocument();
    expect(screen.getByText("Connect An MT5 Terminal")).toBeInTheDocument();
    expect(screen.getByText("Signed Connector Contract")).toBeInTheDocument();
    expect(screen.getByText("Execution Safety Gate")).toBeInTheDocument();
    expect(screen.getByText("Trade Command Channel")).toBeInTheDocument();
    expect(screen.getByText("AI Bridge Diagnostics")).toBeInTheDocument();
    expect(screen.getByText("Token Controls")).toBeInTheDocument();
    expect(screen.queryByText(/sha256:comp/)).not.toBeInTheDocument();
    expect(screen.getByText("1 blocked")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Rotate Bridge Token/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Disable EA Trading Channel/i })).toBeDisabled();
  });

  it("filters the instance registry", () => {
    render(<EaBridgeDashboard />);
    fireEvent.change(screen.getByLabelText("Search EA instances"), { target: { value: "NexusExecutionEA" } });
    const registry = within(screen.getByRole("table", { name: "EA instance registry" }));
    expect(registry.getByText("NexusExecutionEA")).toBeInTheDocument();
    expect(registry.queryByText("NexusPropEA")).not.toBeInTheDocument();
  });
});

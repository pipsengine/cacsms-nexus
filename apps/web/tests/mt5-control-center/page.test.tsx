import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Mt5ControlCenterDashboard } from "@/modules/mt5-infrastructure-and-broker-connectivity/mt5-control-center/components/mt5-control-center-dashboard";

vi.mock("@/modules/mt5-infrastructure-and-broker-connectivity/mt5-control-center/hooks/use-mt5-control-center", async () => {
  const { buildControlCenter } = await import("@/app/api/mt5/_lib/store");
  const { seedMt5ControlCenterStore } = await import("@/tests/helpers/seed-api-stores");
  seedMt5ControlCenterStore();
  return {
    useMt5ControlCenter: () => ({
      data: buildControlCenter("Read-Only Viewer"),
      isLoading: false,
      isError: false,
      streamConnected: true,
      refetch: vi.fn(),
      action: { mutateAsync: vi.fn(), isPending: false }
    })
  };
});

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo) => {
    if (String(input).includes("/api/mt5/onboarding/defaults")) {
      return new Response(JSON.stringify({
        terminalUuid: "00000000-0000-4000-8000-000000000001",
        terminalVersion: "5.00 build 4770",
        eaName: "NexusBridgeEA",
        symbolScope: ["EURUSD", "XAUUSD"]
      }));
    }
    return new Response(JSON.stringify({}), { status: 404 });
  }));
});

describe("MT5 Control Center dashboard", () => {
  it("renders health panels and disables protected actions for viewers", () => {
    render(<Mt5ControlCenterDashboard />);
    expect(screen.getByRole("heading", { name: "MT5 Control Center" })).toBeInTheDocument();
    expect(screen.getByText("Terminal Health Monitor")).toBeInTheDocument();
    expect(screen.getByText("Infrastructure Registration")).toBeInTheDocument();
    expect(screen.getByText("AI Diagnostics & Recommendations")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Register Terminal/i })).toBeEnabled();
    expect(screen.getByText(/Registration is locked for role/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Provision Terminal/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Emergency Disable Trading/i })).toBeDisabled();
    expect(screen.getAllByRole("button", { name: /Restart Terminal|Restart/i }).every((button) => button.hasAttribute("disabled"))).toBe(true);
  });
});

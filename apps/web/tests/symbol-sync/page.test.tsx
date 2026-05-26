import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SymbolSyncDashboard } from "@/modules/mt5-infrastructure-and-broker-connectivity/symbol-sync/components/symbol-sync-dashboard";

vi.mock("@/modules/mt5-infrastructure-and-broker-connectivity/symbol-sync/hooks/use-symbol-sync", async () => {
  const { buildSymbolSyncResponse } = await import("@/app/api/mt5/symbol-sync/_lib/store");
  const { seedSymbolSyncStore } = await import("@/tests/helpers/seed-api-stores");
  seedSymbolSyncStore();
  return {
    useSymbolSync: () => ({
      data: buildSymbolSyncResponse("Read-Only Viewer"),
      isLoading: false,
      isError: false,
      streamConnected: true,
      refetch: vi.fn(),
      action: { mutateAsync: vi.fn(), isPending: false }
    })
  };
});
afterEach(cleanup);

describe("Symbol Sync dashboard", () => {
  it("renders instrument operations and protects viewer controls", () => {
    render(<SymbolSyncDashboard />);
    expect(screen.getByRole("heading", { name: "Symbol Sync" })).toBeInTheDocument();
    expect(screen.getByText("Symbol Mapping Registry")).toBeInTheDocument();
    expect(screen.getByText("AI Symbol Diagnostics")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Sync All Symbols/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Validate Selected/i })).toBeDisabled();
  });

  it("filters the scrollable symbol registry", () => {
    render(<SymbolSyncDashboard />);
    fireEvent.change(screen.getByLabelText("Search synchronized symbols"), { target: { value: "FTMO" } });
    const registry = within(screen.getByRole("table", { name: "Symbol synchronization registry" }));
    expect(registry.getAllByText("FTMO").length).toBeGreaterThan(0);
    expect(registry.queryByText("IC Markets")).not.toBeInTheDocument();
  });
});

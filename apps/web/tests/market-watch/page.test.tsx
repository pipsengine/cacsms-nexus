import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MarketWatchDashboard } from "@/modules/mt5-infrastructure-and-broker-connectivity/market-watch/components/market-watch-dashboard";

vi.mock("@/modules/mt5-infrastructure-and-broker-connectivity/market-watch/hooks/use-market-watch", async () => {
  const { buildMarketWatchResponse } = await import("@/app/api/mt5/market-watch/_lib/store");
  const { seedMarketWatchStore } = await import("@/tests/helpers/seed-api-stores");
  seedMarketWatchStore();
  return {
    useMarketWatch: () => ({
      data: buildMarketWatchResponse("Read-Only Viewer"),
      isLoading: false,
      isError: false,
      streamConnected: true,
      refetch: vi.fn(),
      action: { mutateAsync: vi.fn(), isPending: false }
    })
  };
});
afterEach(cleanup);

describe("Market Watch dashboard", () => {
  it("renders detailed quote intelligence and protects viewer actions", () => {
    render(<MarketWatchDashboard />);
    expect(screen.getByRole("heading", { name: "Market Watch" })).toBeInTheDocument();
    expect(screen.getByText("Market Sessions & Liquidity")).toBeInTheDocument();
    expect(screen.getByText("Live Quote Board")).toBeInTheDocument();
    expect(screen.getByText("AI Market Diagnostics")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Refresh Quotes/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Diagnostics/i })).toBeDisabled();
  });

  it("filters the instrument quote board", () => {
    render(<MarketWatchDashboard />);
    fireEvent.change(screen.getByLabelText("Search market instruments"), { target: { value: "Gold" } });
    const table = within(screen.getByRole("table", { name: "Market watch quote board" }));
    expect(table.getByText("XAUUSD")).toBeInTheDocument();
    expect(table.queryByText("EURUSD")).not.toBeInTheDocument();
  });
});

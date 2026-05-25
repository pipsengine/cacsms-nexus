import { describe, expect, it, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { TradeSynchronizationDashboard } from "@/modules/mt5-infrastructure-and-broker-connectivity/trade-synchronization/components/trade-synchronization-dashboard";

beforeEach(() => {
  if (!(globalThis as any).ResizeObserver) {
    (globalThis as any).ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  window.history.pushState({}, "", "/mt5-infrastructure-and-broker-connectivity/trade-synchronization?mock=1");
});

describe("TradeSynchronizationDashboard", () => {
  it("renders header and trade table", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={client}>
        <TradeSynchronizationDashboard />
      </QueryClientProvider>
    );

    expect(screen.getByText("Trade Synchronization")).toBeInTheDocument();
    expect(screen.getByText("Trade Synchronization Table")).toBeInTheDocument();

    expect(await screen.findByText("trd_001")).toBeInTheDocument();
  });
});


import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { TradeSynchronizationDashboard } from "@/modules/mt5-infrastructure-and-broker-connectivity/trade-synchronization/components/trade-synchronization-dashboard";
import { installFetchMock, setupDashboardTestEnv, teardownDashboardTestEnv } from "../helpers/dashboard-test-env";

const timestamp = new Date().toISOString();
const trade = {
  tradeId: "trd_001",
  mt5Ticket: "45811234",
  orderId: "ord_901",
  signalId: "sig_2201",
  strategyId: "strat_inst_momentum",
  account: "FTMO Challenge - Demo",
  broker: "MockBroker",
  terminal: "MT5-Terminal-1",
  eaInstance: "EA-Instance-A",
  symbol: "XAUUSD",
  normalizedSymbol: "XAUUSD",
  direction: "Buy",
  orderType: "Market",
  volumeRequested: 1.0,
  volumeFilled: 1.0,
  entryPrice: 2321.45,
  currentPrice: 2324.12,
  stopLoss: 2312.0,
  takeProfit: 2338.0,
  closePrice: null,
  tradeStatus: "Open",
  nexusState: "OPEN",
  mt5State: "OPEN",
  syncStatus: "Synced",
  stateMatchStatus: "Matched",
  floatingProfitLoss: 267.0,
  realizedProfitLoss: 0,
  swap: 0,
  commission: 0,
  netProfitLoss: 267.0,
  marginUsed: 1200,
  openTime: timestamp,
  closeTime: null,
  lastMt5UpdateAt: timestamp,
  lastNexusUpdateAt: timestamp,
  lastSyncAt: timestamp,
  syncDelaySeconds: 0,
  riskLevel: "Moderate"
};

beforeEach(() => {
  setupDashboardTestEnv();
  installFetchMock({
    "/trade-synchronization/summary": () => ({
      meta: { timestamp, environment: "Development", frozen: false },
      kpis: {
        totalActiveTrades: 1,
        syncedTrades: 1,
        pendingSync: 0,
        failedSync: 0,
        tradeStateMismatches: 0,
        openPositions: 1,
        pendingOrders: 0,
        closedTradesToday: 0,
        partialFills: 0,
        modificationEvents: 0,
        averageSyncDelaySeconds: 0,
        tradeSyncHealthScore: { score: 0, explanation: "", factors: {}, penalties: {} }
      },
      workflow: []
    }),
    "/trade-synchronization/trades": () => ({ meta: { timestamp, total: 1, page: 1, pageSize: 25 }, trades: [trade] }),
    "/trade-synchronization/logs": () => ({ meta: { timestamp, total: 0 }, logs: [] }),
    "/trade-synchronization/exceptions": () => ({ meta: { timestamp, total: 0 }, logs: [] }),
    "/trade-synchronization/ai-diagnostics": () => ({ meta: { timestamp }, diagnostics: [] })
  });
});

afterEach(() => {
  teardownDashboardTestEnv();
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

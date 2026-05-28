import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams()
}));

import { DesktopAutomationHubDashboard } from "@/modules/autonomous-computer-operator/desktop-automation-hub/components/desktop-automation-hub-dashboard";
import { TOP_DOWN_TIMEFRAMES } from "@/modules/autonomous-computer-operator/desktop-automation-hub/types/desktop-automation-hub.types";
import { createChartControlSeed } from "@/tests/fixtures/chart-control.fixture";
import { createTerminalStatusSeed } from "@/tests/fixtures/terminal-status.fixture";
import { installFetchMock, setupDashboardTestEnv, teardownDashboardTestEnv } from "../helpers/dashboard-test-env";

const timestamp = new Date().toISOString();
const terminal = createTerminalStatusSeed().terminals[0]!;
const instruments = createChartControlSeed().instruments;

const payload = {
  meta: {
    timestamp,
    currentRole: "Infrastructure Admin",
    streamEndpoint: "/api/autonomous-computer-operator/desktop-automation-hub/events-stream",
    monitoringMode: "Autonomous Desktop Operator — Top-Down Chart Analysis",
    highlightedTerminalId: null,
    operatorReadiness: { score: 75, rating: "Healthy", factors: ["Ready terminals: 2/4"] }
  },
  kpis: [
    { label: "Operator Readiness", value: "75/100", status: "Watch", detail: "Healthy", updatedAt: timestamp },
    { label: "Top-Down Frames", value: String(TOP_DOWN_TIMEFRAMES.length), status: "Healthy", detail: TOP_DOWN_TIMEFRAMES.join(" → "), updatedAt: timestamp }
  ],
  operator: {
    autonomousMode: true,
    activeRunId: null,
    lastCompletedAt: null,
    description: "Operates MT5 without human input."
  },
  topDownTimeframes: [...TOP_DOWN_TIMEFRAMES],
  terminals: [
    {
      terminalId: terminal.terminalId,
      terminalName: terminal.terminalName,
      hostMachine: terminal.hostMachine,
      brokerName: terminal.brokerName,
      accountLogin: terminal.accountLogin,
      processStatus: terminal.processStatus,
      automationReady: true,
      automationBlockers: [],
      status: "Healthy"
    }
  ],
  symbols: [
    { symbol: "EURUSD", normalizedSymbol: "EURUSD", brokers: ["IC Markets"], instrumentIds: [] },
    { symbol: "GBPUSD", normalizedSymbol: "GBPUSD", brokers: ["IC Markets"], instrumentIds: ["chart-broker-icm-sc-demo-gbpusd"] },
    { symbol: "XAUUSD", normalizedSymbol: "XAUUSD", brokers: ["IC Markets"], instrumentIds: [] }
  ],
  activeRun: null,
  recentRuns: [],
  permissions: {
    role: "Infrastructure Admin",
    canStartAutomation: true,
    canCancelAutomation: true,
    canViewAiCaptures: true
  }
};

afterEach(() => {
  cleanup();
  teardownDashboardTestEnv();
});

beforeEach(() => {
  setupDashboardTestEnv();
  installFetchMock({
    "/autonomous-computer-operator/desktop-automation-hub": () => payload
  });
});

describe("Desktop Automation Hub page", () => {
  it("renders top-down automation controls and operator description", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <DesktopAutomationHubDashboard />
      </QueryClientProvider>
    );

    expect(await screen.findByRole("heading", { name: "Desktop Automation Hub" })).toBeInTheDocument();
    expect(screen.getByText(/Operates the computer without human input/i)).toBeInTheDocument();
    expect(screen.getByText("Start Top-Down Analysis (No Human Input)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Run Top-Down Analysis" })).toBeInTheDocument();
    expect(screen.getByLabelText("Trading pair")).toBeInTheDocument();
    expect(screen.getByLabelText("MT5 terminal")).toBeInTheDocument();
  });
});

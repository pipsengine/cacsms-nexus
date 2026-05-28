import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams()
}));

import { OperatorDashboard } from "@/modules/autonomous-computer-operator/operator-dashboard/components/operator-dashboard";
import { mapToOperatorDashboardResponse } from "@/modules/autonomous-computer-operator/operator-dashboard/algorithms/operator-dashboard.algorithms";
import { createTerminalStatusSeed } from "@/tests/fixtures/terminal-status.fixture";
import { createEaBridgeSeed } from "@/tests/fixtures/ea-bridge.fixture";
import { createConnectionHealthSeed } from "@/tests/fixtures/connection-health.fixture";
import { createOrderRouterSeed } from "@/tests/fixtures/order-router.fixture";
import { installFetchMock, setupDashboardTestEnv, teardownDashboardTestEnv } from "../helpers/dashboard-test-env";

const timestamp = new Date().toISOString();
const terminalSeed = createTerminalStatusSeed();
const eaSeed = createEaBridgeSeed();
const routerSeed = createOrderRouterSeed();

const payload = mapToOperatorDashboardResponse({
  bundle: {
    terminalStatus: {
      meta: { timestamp, currentRole: "Infrastructure Admin", streamEndpoint: "/api/mt5/terminal-status/events-stream", monitoringMode: "Autonomous" },
      kpis: [],
      workflow: [],
      terminals: terminalSeed.terminals,
      heartbeatLogs: terminalSeed.heartbeatLogs,
      events: terminalSeed.events,
      errors: terminalSeed.errors,
      diagnostics: terminalSeed.diagnostics,
      audits: [],
      resourceSummary: { averageCpu: 45, averageMemory: 54, averageDisk: 48, averageLatency: 210, pressureScore: 62 },
      permissions: {
        role: "Infrastructure Admin",
        canSync: true,
        canRunHealthCheck: true,
        canRestart: true,
        canTradeControl: true,
        canMaintenance: true,
        canEmergencyDisable: true,
        canAutoRemediate: true
      }
    },
    eaBridge: {
      meta: { timestamp, currentRole: "Infrastructure Admin", streamEndpoint: "/api/mt5/ea-bridge/events-stream", monitoringMode: "Autonomous Secure Bridge" },
      kpis: [],
      bridgeHealth: { score: 74, rating: "Healthy", factors: {} },
      workflow: [],
      instances: eaSeed.instances,
      sessions: eaSeed.sessions,
      messages: eaSeed.messages,
      commands: eaSeed.commands,
      logs: eaSeed.logs,
      diagnostics: eaSeed.diagnostics,
      audits: [],
      permissions: {
        role: "Infrastructure Admin",
        canSync: true,
        canDiagnostics: true,
        canRestart: true,
        canRotateToken: true,
        canReissuePairing: true,
        canTradeControl: true,
        canRebindTerminal: true,
        canEmergencyDisable: true,
        canAutoRemediate: true
      },
      activePairing: {}
    },
    connectionSummary: {
      meta: { timestamp, currentRole: "Infrastructure Admin", streamEndpoint: "/api/mt5/connection-health/events-stream" },
      kpis: [],
      overallHealth: { score: 82, rating: "Healthy", factors: {} },
      infrastructureRiskLevel: "Moderate"
    },
    orderRouter: {
      meta: {
        timestamp,
        currentRole: "Infrastructure Admin",
        streamEndpoint: "/api/mt5/order-router/events-stream",
        monitoringMode: "Autonomous Audited Routing",
        routingPaused: false,
        emergencyStopActive: false
      },
      kpis: [],
      health: { score: 81, rating: "Healthy", factors: {} },
      workflow: [],
      routes: routerSeed.routes,
      channels: routerSeed.channels,
      blockedOrders: routerSeed.blockedOrders,
      feedback: routerSeed.feedback,
      logs: routerSeed.logs,
      diagnostics: routerSeed.diagnostics,
      audits: [],
      permissions: {
        role: "Infrastructure Admin",
        canSync: true,
        canDiagnostics: true,
        canPauseResume: true,
        canEmergencyStop: true,
        canRetry: true,
        canCancel: true,
        canRevalidate: true,
        canReviewBlocked: true,
        canAutoRemediate: true,
        canDispatch: true,
        canSubmitTest: true,
        canSubmitSignal: true
      }
    },
    executionQueue: {
      meta: { timestamp, currentRole: "Infrastructure Admin", queuePaused: false, emergencyStopActive: false },
      kpis: [],
      health: { score: 79, rating: "Healthy", factors: {} },
      workflow: [],
      permissions: {
        role: "Infrastructure Admin",
        canProcess: true,
        canPauseResume: true,
        canRetry: true,
        canCancel: true,
        canValidate: true,
        canReassignRoute: true,
        canEmergencyStop: true,
        canDiagnostics: true,
        canAutoRemediate: true
      }
    },
    unsafeTradingDisabled: false,
    connectionComponents: createConnectionHealthSeed().components
  },
  role: "Infrastructure Admin",
  highlightedHost: null
});

afterEach(() => {
  cleanup();
  teardownDashboardTestEnv();
});

beforeEach(() => {
  setupDashboardTestEnv();
  installFetchMock({
    "/autonomous-computer-operator/operator-dashboard": () => payload
  });
});

describe("Operator Dashboard page", () => {
  it("renders lanes, safety posture, and terminal readiness table", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <OperatorDashboard />
      </QueryClientProvider>
    );

    expect(await screen.findByRole("heading", { name: "Operator Dashboard" })).toBeInTheDocument();
    expect(screen.getByText("Operator Lanes")).toBeInTheDocument();
    expect(screen.getByText("Safety Posture")).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Terminal operator readiness" })).toBeInTheDocument();
  });
});

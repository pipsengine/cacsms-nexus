import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams()
}));

import { RemoteControlHubDashboard } from "@/modules/autonomous-computer-operator/remote-control-hub/components/remote-control-hub-dashboard";
import { mapToRemoteControlHubResponse } from "@/modules/autonomous-computer-operator/remote-control-hub/algorithms/remote-control-hub.algorithms";
import { createTerminalStatusSeed } from "@/tests/fixtures/terminal-status.fixture";
import { createEaBridgeSeed } from "@/tests/fixtures/ea-bridge.fixture";
import { createConnectionHealthSeed } from "@/tests/fixtures/connection-health.fixture";
import { installFetchMock, setupDashboardTestEnv, teardownDashboardTestEnv } from "../helpers/dashboard-test-env";

const timestamp = new Date().toISOString();
const terminalSeed = createTerminalStatusSeed();
const eaSeed = createEaBridgeSeed();

const payload = mapToRemoteControlHubResponse({
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
    hostComponents: createConnectionHealthSeed().components.filter((component) => component.componentType === "Host Machine")
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
    "/autonomous-computer-operator/remote-control-hub": () => payload
  });
});

describe("Remote Control Hub page", () => {
  it("renders capabilities, VPS inventory, and remote sessions", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <RemoteControlHubDashboard />
      </QueryClientProvider>
    );

    expect(await screen.findByRole("heading", { name: "Remote Control Hub" })).toBeInTheDocument();
    expect(screen.getByText("Control Capabilities")).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "VPS and computer inventory" })).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Remote sessions" })).toBeInTheDocument();
  });
});

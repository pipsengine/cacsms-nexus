import { describe, expect, it } from "vitest";
import {
  buildApplicationHealthRows,
  buildApplicationLauncherRows,
  buildMt5AutomationRows,
  buildRemoteControlCapabilities,
  buildRemoteSessionRows,
  buildVpsComputerRows,
  mapToRemoteControlHubResponse,
  sessionStabilityScore,
  vpsControlScore
} from "@/modules/autonomous-computer-operator/remote-control-hub/algorithms/remote-control-hub.algorithms";
import type { RemoteControlTelemetryBundle } from "@/modules/autonomous-computer-operator/remote-control-hub/types/remote-control-hub.types";
import type { EaBridgeResponse } from "@/modules/mt5-infrastructure-and-broker-connectivity/ea-bridge/types/ea-bridge.types";
import type { TerminalStatusResponse } from "@/modules/mt5-infrastructure-and-broker-connectivity/terminal-status/types/terminal-status.types";
import { createTerminalStatusSeed } from "@/tests/fixtures/terminal-status.fixture";
import { createEaBridgeSeed } from "@/tests/fixtures/ea-bridge.fixture";
import { createConnectionHealthSeed } from "@/tests/fixtures/connection-health.fixture";

function buildFixtureBundle(): RemoteControlTelemetryBundle {
  const terminalSeed = createTerminalStatusSeed();
  const eaSeed = createEaBridgeSeed();
  const connectionSeed = createConnectionHealthSeed();
  const timestamp = new Date().toISOString();

  const terminalStatus: TerminalStatusResponse = {
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
  };

  const eaBridge: EaBridgeResponse = {
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
  };

  return {
    terminalStatus,
    eaBridge,
    connectionSummary: {
      meta: { timestamp, currentRole: "Infrastructure Admin", streamEndpoint: "/api/mt5/connection-health/events-stream" },
      kpis: [],
      overallHealth: { score: 82, rating: "Healthy", factors: {} },
      infrastructureRiskLevel: "Moderate"
    },
    hostComponents: connectionSeed.components.filter((component) => component.componentType === "Host Machine")
  };
}

describe("Remote Control Hub algorithms", () => {
  it("scores remote session stability from auth and latency", () => {
    const session = createEaBridgeSeed().sessions[0]!;
    const degraded = createEaBridgeSeed().sessions[2]!;
    expect(sessionStabilityScore(session)).toBeGreaterThan(sessionStabilityScore(degraded));
  });

  it("builds VPS inventory with control scores", () => {
    const bundle = buildFixtureBundle();
    const rows = buildVpsComputerRows(bundle);
    expect(rows.length).toBeGreaterThan(1);
    expect(rows[0]?.controlScore).toBeGreaterThan(0);
    expect(vpsControlScore(bundle.terminalStatus.terminals, bundle.hostComponents, bundle.eaBridge.sessions, rows[0]!.hostMachine)).toBe(rows[0]!.controlScore);
  });

  it("maps sessions, automation, launcher, and health rows", () => {
    const bundle = buildFixtureBundle();
    expect(buildRemoteSessionRows(bundle).length).toBe(bundle.eaBridge.sessions.length);
    expect(buildMt5AutomationRows(bundle).length).toBe(bundle.terminalStatus.terminals.length);
    expect(buildApplicationLauncherRows(bundle).length).toBe(bundle.terminalStatus.terminals.length);
    expect(buildApplicationHealthRows(bundle).length).toBe(bundle.terminalStatus.terminals.length);
  });

  it("derives six consolidated control capabilities", () => {
    const bundle = buildFixtureBundle();
    const vpsRows = buildVpsComputerRows(bundle);
    const sessions = buildRemoteSessionRows(bundle);
    const automation = buildMt5AutomationRows(bundle);
    const launchers = buildApplicationLauncherRows(bundle);
    const health = buildApplicationHealthRows(bundle);
    const capabilities = buildRemoteControlCapabilities(vpsRows, sessions, automation, launchers, health);
    expect(capabilities).toHaveLength(6);
    expect(capabilities.map((capability) => capability.id)).toContain("remote-session-manager");
  });

  it("maps a full remote control hub response", () => {
    const bundle = buildFixtureBundle();
    const response = mapToRemoteControlHubResponse({
      bundle,
      role: "Infrastructure Admin",
      highlightedHost: bundle.terminalStatus.terminals[0]?.hostMachine ?? null
    });
    expect(response.meta.monitoringMode).toMatch(/Remote Control/i);
    expect(response.kpis.length).toBeGreaterThan(6);
    expect(response.workflow).toHaveLength(6);
    expect(response.capabilities).toHaveLength(6);
    expect(response.permissions.canManageSessions).toBe(true);
  });
});

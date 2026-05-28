import { beforeEach, describe, expect, it } from "vitest";
import {
  buildOperatorHostSnapshots,
  buildOperatorLanes,
  buildOperatorSafetyState,
  buildOperatorTerminalRows,
  mapToOperatorDashboardResponse,
  overallOperatorReadinessScore,
  remoteControlLaneScore,
  resourcePressureScore,
  terminalReadinessScore
} from "@/modules/autonomous-computer-operator/operator-dashboard/algorithms/operator-dashboard.algorithms";
import type { OperatorTelemetryBundle } from "@/modules/autonomous-computer-operator/operator-dashboard/types/operator-dashboard.types";
import type { EaBridgeResponse } from "@/modules/mt5-infrastructure-and-broker-connectivity/ea-bridge/types/ea-bridge.types";
import type { RouterResponse } from "@/modules/mt5-infrastructure-and-broker-connectivity/order-router/types/order-router.types";
import type { TerminalStatusResponse } from "@/modules/mt5-infrastructure-and-broker-connectivity/terminal-status/types/terminal-status.types";
import { createTerminalStatusSeed } from "@/tests/fixtures/terminal-status.fixture";
import { createEaBridgeSeed } from "@/tests/fixtures/ea-bridge.fixture";
import { createConnectionHealthSeed } from "@/tests/fixtures/connection-health.fixture";
import { createOrderRouterSeed } from "@/tests/fixtures/order-router.fixture";

function buildFixtureBundle(): OperatorTelemetryBundle {
  const terminalSeed = createTerminalStatusSeed();
  const eaSeed = createEaBridgeSeed();
  const routerSeed = createOrderRouterSeed();
  const timestamp = new Date().toISOString();
  const terminals = terminalSeed.terminals;

  const terminalStatus: TerminalStatusResponse = {
    meta: { timestamp, currentRole: "Infrastructure Admin", streamEndpoint: "/api/mt5/terminal-status/events-stream", monitoringMode: "Autonomous" },
    kpis: [],
    workflow: [],
    terminals,
    heartbeatLogs: terminalSeed.heartbeatLogs,
    events: terminalSeed.events,
    errors: terminalSeed.errors,
    diagnostics: terminalSeed.diagnostics,
    audits: [],
    resourceSummary: {
      averageCpu: 45,
      averageMemory: 54,
      averageDisk: 48,
      averageLatency: 210,
      pressureScore: 62
    },
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

  const orderRouter: RouterResponse = {
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
    orderRouter,
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
  };
}

describe("Operator Dashboard algorithms", () => {
  it("scores host resource pressure inversely to utilization", () => {
    expect(resourcePressureScore(20, 30, 25)).toBeGreaterThan(70);
    expect(resourcePressureScore(90, 92, 88)).toBeLessThan(20);
  });

  it("penalizes offline or delayed terminals in readiness scoring", () => {
    const healthy = createTerminalStatusSeed().terminals[0]!;
    const degraded = createTerminalStatusSeed().terminals[1]!;
    expect(terminalReadinessScore(healthy)).toBeGreaterThan(terminalReadinessScore(degraded));
  });

  it("builds host snapshots grouped by execution machine", () => {
    const bundle = buildFixtureBundle();
    const hosts = buildOperatorHostSnapshots(bundle);
    expect(hosts.length).toBeGreaterThan(1);
    expect(hosts[0]?.terminalCount).toBeGreaterThan(0);
  });

  it("derives four operator lanes with readiness scores", () => {
    const bundle = buildFixtureBundle();
    const safety = buildOperatorSafetyState(bundle);
    const hosts = buildOperatorHostSnapshots(bundle);
    const lanes = buildOperatorLanes(bundle, safety, hosts);
    expect(lanes).toHaveLength(4);
    expect(lanes.every((lane) => lane.readinessScore >= 0 && lane.readinessScore <= 100)).toBe(true);
    expect(remoteControlLaneScore(bundle, hosts)).toBeGreaterThan(0);
  });

  it("maps a full operator dashboard response", () => {
    const bundle = buildFixtureBundle();
    const response = mapToOperatorDashboardResponse({
      bundle,
      role: "Infrastructure Admin",
      highlightedHost: bundle.terminalStatus.terminals[0]?.hostMachine ?? null
    });
    expect(response.meta.monitoringMode).toMatch(/Operator Command Center/i);
    expect(response.kpis.length).toBeGreaterThan(6);
    expect(response.workflow).toHaveLength(8);
    expect(response.lanes).toHaveLength(4);
    expect(response.terminals.length).toBe(bundle.terminalStatus.terminals.length);
    expect(response.permissions.canAutoRemediate).toBe(true);
    expect(overallOperatorReadinessScore(response.lanes, response.safety).score).toBeGreaterThan(0);
    expect(buildOperatorTerminalRows(bundle).length).toBe(bundle.terminalStatus.terminals.length);
  });
});

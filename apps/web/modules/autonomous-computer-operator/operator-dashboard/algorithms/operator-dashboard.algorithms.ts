import { tradingPathSafety } from "@/modules/mt5-infrastructure-and-broker-connectivity/connection-health/algorithms/connection-health.algorithms";
import type { ConnectionComponent, ComponentType } from "@/modules/mt5-infrastructure-and-broker-connectivity/connection-health/types/connection-health.types";
import type {
  OperatorDashboardResponse,
  OperatorHostSnapshot,
  OperatorLane,
  OperatorRecommendedAction,
  OperatorSafetyState,
  OperatorTelemetryBundle,
  OperatorTerminalRow,
  OperatorTone,
  OperatorWarning,
  OperatorWorkflowNode
} from "../types/operator-dashboard.types";

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function toneFromScore(score: number): OperatorTone {
  if (score >= 85) return "Healthy";
  if (score >= 70) return "Watch";
  if (score >= 50) return "Degraded";
  if (score >= 25) return "Critical";
  return "Offline";
}

function worstTone(left: OperatorTone, right: OperatorTone): OperatorTone {
  const order: OperatorTone[] = ["Healthy", "Syncing", "Watch", "Inactive", "Degraded", "Critical", "Offline"];
  return order.indexOf(left) >= order.indexOf(right) ? left : right;
}

export function resourcePressureScore(cpu: number, memory: number, disk: number) {
  const weighted = cpu * 0.35 + memory * 0.4 + disk * 0.25;
  return clamp(Math.round(100 - weighted), 0, 100);
}

export function terminalReadinessScore(terminal: OperatorTelemetryBundle["terminalStatus"]["terminals"][number]) {
  let score = terminal.healthScore;
  if (terminal.processStatus !== "Running") score -= 35;
  if (terminal.heartbeatDelaySeconds > 60) score -= 18;
  else if (terminal.heartbeatDelaySeconds > 30) score -= 8;
  if (terminal.restartRequired) score -= 12;
  if (terminal.maintenanceMode) score -= 10;
  if (!terminal.orderGatewayConnected) score -= 15;
  if (!terminal.marketDataActive) score -= 8;
  if (terminal.connectionStatus === "Offline") score -= 40;
  if (terminal.connectionStatus === "Critical") score -= 25;
  return clamp(Math.round(score), 0, 100);
}

export function bridgeLaneScore(bundle: OperatorTelemetryBundle) {
  const bridge = bundle.eaBridge.bridgeHealth.score;
  const connected = bundle.eaBridge.instances.filter((instance) => instance.connectionStatus === "Healthy").length;
  const total = Math.max(1, bundle.eaBridge.instances.length);
  const coverage = (connected / total) * 100;
  const latencyPenalty = bundle.eaBridge.instances.some((instance) => instance.averageLatencyMs > 250) ? 12 : 0;
  return clamp(Math.round(bridge * 0.55 + coverage * 0.45 - latencyPenalty), 0, 100);
}

export function remoteControlLaneScore(bundle: OperatorTelemetryBundle, hosts: OperatorHostSnapshot[]) {
  const terminals = bundle.terminalStatus.terminals;
  if (!terminals.length) return 0;
  const avgReadiness = terminals.reduce((sum, terminal) => sum + terminalReadinessScore(terminal), 0) / terminals.length;
  const hostScore = hosts.length ? hosts.reduce((sum, host) => sum + host.resourcePressureScore, 0) / hosts.length : avgReadiness;
  const onlineHosts = hosts.filter((host) => host.status !== "Offline" && host.status !== "Critical").length;
  const hostCoverage = hosts.length ? (onlineHosts / hosts.length) * 100 : 100;
  return clamp(Math.round(avgReadiness * 0.5 + hostScore * 0.3 + hostCoverage * 0.2), 0, 100);
}

export function desktopAutomationLaneScore(bundle: OperatorTelemetryBundle) {
  const terminals = bundle.terminalStatus.terminals;
  if (!terminals.length) return 0;
  const running = terminals.filter((terminal) => terminal.processStatus === "Running").length;
  const eaEnabled = terminals.filter((terminal) => terminal.expertAdvisorsEnabled).length;
  const uiReady = terminals.filter((terminal) => terminal.marketDataActive && terminal.symbolMappingsValid).length;
  const total = terminals.length;
  const processScore = (running / total) * 100;
  const eaScore = (eaEnabled / total) * 100;
  const uiScore = (uiReady / total) * 100;
  const resource = bundle.terminalStatus.resourceSummary;
  const pressurePenalty = clamp((resource.pressureScore - 70) / 2, 0, 18);
  return clamp(Math.round(processScore * 0.35 + eaScore * 0.25 + uiScore * 0.25 + (100 - pressurePenalty) * 0.15), 0, 100);
}

export function mt5ExecutionLaneScore(bundle: OperatorTelemetryBundle, safety: OperatorSafetyState) {
  const connectionScore = bundle.connectionSummary.overallHealth.score;
  const routerScore = bundle.orderRouter.health?.score ?? 75;
  const queueScore = bundle.executionQueue.health.score;
  const safetyPenalty = safety.globalKillSwitchActive ? 45 : safety.routingEmergencyStop || safety.queueEmergencyStop ? 30 : 0;
  return clamp(Math.round(connectionScore * 0.35 + routerScore * 0.35 + queueScore * 0.3 - safetyPenalty), 0, 100);
}

export function recoverySafetyLaneScore(bundle: OperatorTelemetryBundle, safety: OperatorSafetyState) {
  let score = 100;
  if (safety.globalKillSwitchActive) score -= 35;
  if (safety.routingEmergencyStop) score -= 20;
  if (safety.queueEmergencyStop) score -= 20;
  if (!safety.tradingPathSafe) score -= 15;
  if (bundle.connectionSummary.infrastructureRiskLevel === "Critical") score -= 25;
  else if (bundle.connectionSummary.infrastructureRiskLevel === "High") score -= 12;
  const restartRequired = bundle.terminalStatus.terminals.filter((terminal) => terminal.restartRequired).length;
  score -= Math.min(restartRequired * 8, 24);
  return clamp(Math.round(score), 0, 100);
}

export function buildOperatorSafetyState(bundle: OperatorTelemetryBundle): OperatorSafetyState {
  const routingStop = bundle.orderRouter.meta.emergencyStopActive;
  const queueStop = bundle.executionQueue.meta.emergencyStopActive;
  const unsafeDisabled = bundle.unsafeTradingDisabled;
  const globalKillSwitchActive = routingStop || queueStop || unsafeDisabled;

  const componentByType: Partial<Record<ComponentType, ConnectionComponent>> = {};
  for (const component of bundle.connectionComponents ?? []) {
    componentByType[component.componentType] = component;
  }

  const path = tradingPathSafety(componentByType, !globalKillSwitchActive);
  const pipelineHealthy =
    bundle.eaBridge.instances.some((instance) => instance.connectionStatus === "Healthy") &&
    bundle.terminalStatus.terminals.some((terminal) => terminal.processStatus === "Running");

  return {
    globalKillSwitchActive,
    routingEmergencyStop: routingStop,
    queueEmergencyStop: queueStop,
    unsafeTradingDisabled: unsafeDisabled,
    autonomousPipelineHealthy: pipelineHealthy,
    tradingPathSafe: path.safe && !globalKillSwitchActive,
    failureReasons: [
      ...(routingStop ? ["Order router emergency stop active"] : []),
      ...(queueStop ? ["Execution queue emergency stop active"] : []),
      ...(unsafeDisabled ? ["Unsafe trading globally disabled"] : []),
      ...path.failures
    ]
  };
}

export function buildOperatorHostSnapshots(bundle: OperatorTelemetryBundle): OperatorHostSnapshot[] {
  const grouped = new Map<string, OperatorTelemetryBundle["terminalStatus"]["terminals"]>();
  for (const terminal of bundle.terminalStatus.terminals) {
    const list = grouped.get(terminal.hostMachine) ?? [];
    list.push(terminal);
    grouped.set(terminal.hostMachine, list);
  }

  return [...grouped.entries()]
    .map(([hostMachine, terminals]) => {
      const average = (selector: (terminal: (typeof terminals)[number]) => number) =>
        terminals.reduce((sum, terminal) => sum + selector(terminal), 0) / terminals.length;
      const healthyTerminals = terminals.filter((terminal) => terminal.connectionStatus === "Healthy").length;
      const pressure = resourcePressureScore(average((t) => t.cpuUsagePercent), average((t) => t.memoryUsagePercent), average((t) => t.diskUsagePercent));
      const status = toneFromScore(pressure);
      const lastHeartbeatAt = terminals
        .map((terminal) => terminal.lastHeartbeatAt)
        .sort((left, right) => right.localeCompare(left))[0]!;

      return {
        hostMachine,
        region: terminals[0]?.region ?? "Unknown",
        operatingSystem: terminals[0]?.operatingSystem ?? "Unknown",
        terminalCount: terminals.length,
        healthyTerminals,
        averageCpuPercent: Math.round(average((t) => t.cpuUsagePercent)),
        averageMemoryPercent: Math.round(average((t) => t.memoryUsagePercent)),
        averageDiskPercent: Math.round(average((t) => t.diskUsagePercent)),
        averageLatencyMs: Math.round(average((t) => t.networkLatencyMs)),
        resourcePressureScore: pressure,
        status,
        lastHeartbeatAt
      };
    })
    .sort((left, right) => right.terminalCount - left.terminalCount);
}

export function buildOperatorTerminalRows(bundle: OperatorTelemetryBundle): OperatorTerminalRow[] {
  return bundle.terminalStatus.terminals
    .map((terminal) => ({
      terminalId: terminal.terminalId,
      terminalName: terminal.terminalName,
      hostMachine: terminal.hostMachine,
      accountLogin: terminal.accountLogin,
      brokerName: terminal.brokerName,
      processStatus: terminal.processStatus,
      connectionStatus: terminal.connectionStatus as OperatorTone,
      heartbeatDelaySeconds: terminal.heartbeatDelaySeconds,
      healthScore: terminal.healthScore,
      readinessScore: terminalReadinessScore(terminal),
      tradingEnabled: terminal.tradingEnabled,
      restartRequired: terminal.restartRequired,
      maintenanceMode: terminal.maintenanceMode
    }))
    .sort((left, right) => right.readinessScore - left.readinessScore);
}

export function buildOperatorLanes(bundle: OperatorTelemetryBundle, safety: OperatorSafetyState, hosts: OperatorHostSnapshot[]): OperatorLane[] {
  const remoteScore = remoteControlLaneScore(bundle, hosts);
  const desktopScore = desktopAutomationLaneScore(bundle);
  const executionScore = mt5ExecutionLaneScore(bundle, safety);
  const recoveryScore = recoverySafetyLaneScore(bundle, safety);

  const lane = (id: OperatorLane["id"], title: string, score: number, blockedCount: number, activeAssets: number, detail: string, href: string): OperatorLane => ({
    id,
    title,
    status: toneFromScore(score),
    readinessScore: score,
    blockedCount,
    activeAssets,
    detail,
    href
  });

  return [
    lane(
      "remote-control",
      "Remote Control",
      remoteScore,
      bundle.terminalStatus.terminals.filter((terminal) => terminal.processStatus !== "Running").length,
      hosts.length,
      "Host reachability, terminal process posture, and session control readiness.",
      "/autonomous-computer-operator/remote-control-hub"
    ),
    lane(
      "desktop-automation",
      "Desktop Automation",
      desktopScore,
      bundle.terminalStatus.terminals.filter((terminal) => !terminal.expertAdvisorsEnabled || !terminal.marketDataActive).length,
      bundle.terminalStatus.terminals.length,
      "Window/UI automation prerequisites derived from terminal and EA state.",
      "/autonomous-computer-operator/desktop-automation-hub"
    ),
    lane(
      "mt5-execution",
      "MT5 Execution",
      executionScore,
      bundle.orderRouter.blockedOrders?.length ?? 0,
      bundle.eaBridge.instances.filter((instance) => instance.connectionStatus === "Healthy").length,
      "Bridge connectivity, routing health, and execution queue posture.",
      "/mt5-infrastructure-and-broker-connectivity/order-router"
    ),
    lane(
      "recovery-safety",
      "Recovery & Safety",
      recoveryScore,
      safety.failureReasons.length,
      bundle.terminalStatus.terminals.filter((terminal) => terminal.restartRequired).length,
      "Kill switch, emergency stops, and autonomous recovery eligibility.",
      "/autonomous-computer-operator/recovery-and-safety-hub"
    )
  ];
}

export function overallOperatorReadinessScore(lanes: OperatorLane[], safety: OperatorSafetyState) {
  const weighted =
    lanes.reduce((sum, lane) => {
      const weight = lane.id === "recovery-safety" ? 0.3 : lane.id === "mt5-execution" ? 0.3 : 0.2;
      return sum + lane.readinessScore * weight;
    }, 0) / 1;
  const penalty = safety.globalKillSwitchActive ? 25 : safety.failureReasons.length * 4;
  const score = clamp(Math.round(weighted - penalty), 0, 100);
  const rating =
    score >= 90 ? "Excellent" : score >= 75 ? "Healthy" : score >= 60 ? "Degraded" : score >= 40 ? "High Risk" : "Critical";
  return { score, rating, factors: lanes.map((lane) => `${lane.title}: ${lane.readinessScore}`) };
}

export function buildOperatorWorkflow(lanes: OperatorLane[], safety: OperatorSafetyState, bundle: OperatorTelemetryBundle): OperatorWorkflowNode[] {
  const step = (title: string, status: OperatorTone, blockedCount: number, detail: string): OperatorWorkflowNode => ({
    title,
    status,
    assetCount: bundle.terminalStatus.terminals.length,
    blockedCount,
    detail
  });

  const remote = lanes.find((lane) => lane.id === "remote-control")!;
  const desktop = lanes.find((lane) => lane.id === "desktop-automation")!;
  const execution = lanes.find((lane) => lane.id === "mt5-execution")!;
  const recovery = lanes.find((lane) => lane.id === "recovery-safety")!;

  return [
    step("Host Discovery", remote.status, bundle.terminalStatus.terminals.length ? 0 : 1, "Execution hosts and VPS inventory synchronized from terminal telemetry."),
    step("Session Posture", remote.status, remote.blockedCount, "Terminal processes, heartbeats, and remote session readiness verified."),
    step("Desktop Context", desktop.status, desktop.blockedCount, "UI automation prerequisites including EA enablement and market data context."),
    step("Bridge Connectivity", execution.status, bundle.eaBridge.instances.filter((i) => i.connectionStatus !== "Healthy").length, "Secure EA bridge instances and command channels validated."),
    step("Execution Routing", execution.status, bundle.orderRouter.meta.routingPaused ? 1 : 0, "Order router and execution queue monitored for autonomous dispatch."),
    step("Safety Controls", recovery.status, safety.failureReasons.length, "Kill switch, emergency stops, and unsafe trading gates evaluated."),
    step("Recovery Eligibility", recovery.status, bundle.terminalStatus.terminals.filter((t) => t.restartRequired).length, "Auto-recovery and remediation workflows assessed against current failures."),
    step("Operator Alerts", worstTone(remote.status, worstTone(desktop.status, worstTone(execution.status, recovery.status))), bundle.terminalStatus.events.filter((e) => e.severity === "Critical").length, "Critical operator events surfaced for human review.")
  ];
}

export function buildOperatorWarnings(
  bundle: OperatorTelemetryBundle,
  safety: OperatorSafetyState,
  hosts: OperatorHostSnapshot[],
  terminals: OperatorTerminalRow[]
): OperatorWarning[] {
  const warnings: OperatorWarning[] = [];

  if (safety.globalKillSwitchActive) {
    warnings.push({
      id: "warn-kill-switch",
      severity: "Critical",
      source: "Safety",
      title: "Global kill switch engaged",
      detail: safety.failureReasons.join(" · ") || "Emergency controls are blocking autonomous operator actions."
    });
  }

  for (const host of hosts.filter((row) => row.resourcePressureScore < 55)) {
    warnings.push({
      id: `warn-host-${host.hostMachine}`,
      severity: host.resourcePressureScore < 35 ? "Critical" : "Degraded",
      source: "Remote Control",
      title: `Host resource pressure on ${host.hostMachine}`,
      detail: `CPU ${host.averageCpuPercent}% · Memory ${host.averageMemoryPercent}% · Disk ${host.averageDiskPercent}%`
    });
  }

  for (const terminal of terminals.filter((row) => row.readinessScore < 50)) {
    warnings.push({
      id: `warn-terminal-${terminal.terminalId}`,
      severity: terminal.readinessScore < 30 ? "Critical" : "Watch",
      source: "Terminal",
      title: `${terminal.terminalName} readiness degraded`,
      detail: `${terminal.accountLogin} on ${terminal.hostMachine} · readiness ${terminal.readinessScore}/100`
    });
  }

  for (const diagnostic of bundle.eaBridge.diagnostics.filter((item) => item.severity === "Critical").slice(0, 3)) {
    warnings.push({
      id: `warn-bridge-${diagnostic.id}`,
      severity: "Critical",
      source: "EA Bridge",
      title: diagnostic.issue,
      detail: diagnostic.recommendation
    });
  }

  if (bundle.connectionSummary.infrastructureRiskLevel === "Critical" || bundle.connectionSummary.infrastructureRiskLevel === "High") {
    warnings.push({
      id: "warn-infra-risk",
      severity: bundle.connectionSummary.infrastructureRiskLevel === "Critical" ? "Critical" : "Degraded",
      source: "Connection Health",
      title: "Infrastructure risk elevated",
      detail: `Connection health score ${bundle.connectionSummary.overallHealth.score}/100 · risk ${bundle.connectionSummary.infrastructureRiskLevel}`
    });
  }

  return warnings.slice(0, 14);
}

export function buildOperatorRecommendedActions(
  bundle: OperatorTelemetryBundle,
  safety: OperatorSafetyState,
  lanes: OperatorLane[]
): OperatorRecommendedAction[] {
  const actions: OperatorRecommendedAction[] = [];

  if (safety.routingEmergencyStop) {
    actions.push({
      id: "action-resume-routing",
      priority: "Immediate",
      title: "Review order router emergency stop",
      detail: "Routing is halted. Confirm safety posture before resuming autonomous dispatch.",
      href: "/mt5-infrastructure-and-broker-connectivity/order-router",
      automatedEligible: false
    });
  }

  if (safety.queueEmergencyStop) {
    actions.push({
      id: "action-review-queue",
      priority: "Immediate",
      title: "Inspect execution queue emergency stop",
      detail: "Queued executions remain frozen until operator clearance.",
      href: "/mt5-infrastructure-and-broker-connectivity/execution-queue",
      automatedEligible: false
    });
  }

  const degradedRemote = lanes.find((lane) => lane.id === "remote-control" && lane.readinessScore < 70);
  if (degradedRemote) {
    actions.push({
      id: "action-remote-control",
      priority: "High",
      title: "Open Remote Control Hub",
      detail: "Investigate offline terminals and host session posture.",
      href: "/autonomous-computer-operator/remote-control-hub",
      automatedEligible: true
    });
  }

  for (const terminal of bundle.terminalStatus.terminals.filter((row) => row.restartRequired).slice(0, 2)) {
    actions.push({
      id: `action-restart-${terminal.terminalId}`,
      priority: "High",
      title: `Restart ${terminal.terminalName}`,
      detail: terminal.lastErrorMessage ?? "Terminal flagged for restart by health monitor.",
      href: "/mt5-infrastructure-and-broker-connectivity/terminal-status",
      automatedEligible: true
    });
  }

  for (const diagnostic of bundle.eaBridge.diagnostics.filter((item) => item.autoFixEligible).slice(0, 2)) {
    actions.push({
      id: `action-bridge-${diagnostic.id}`,
      priority: diagnostic.severity === "Critical" ? "Immediate" : "Normal",
      title: diagnostic.recommendation,
      detail: diagnostic.issue,
      href: "/mt5-infrastructure-and-broker-connectivity/ea-bridge",
      automatedEligible: diagnostic.autoFixStatus === "Available"
    });
  }

  if (bundle.connectionSummary.overallHealth.score < 70) {
    actions.push({
      id: "action-connection-health",
      priority: "High",
      title: "Run connection health diagnostics",
      detail: "Trading path components require review before increasing automation.",
      href: "/mt5-infrastructure-and-broker-connectivity/connection-health",
      automatedEligible: true
    });
  }

  return actions.slice(0, 10);
}

export function buildOperatorKpis(
  lanes: OperatorLane[],
  safety: OperatorSafetyState,
  hosts: OperatorHostSnapshot[],
  terminals: OperatorTerminalRow[],
  overall: OperatorDashboardResponse["meta"]["overallReadiness"],
  timestamp: string
) {
  const avgHostPressure = hosts.length ? hosts.reduce((sum, host) => sum + host.resourcePressureScore, 0) / hosts.length : 0;
  const avgTerminalReadiness = terminals.length ? terminals.reduce((sum, row) => sum + row.readinessScore, 0) / terminals.length : 0;
  const criticalWarnings = safety.failureReasons.length;

  return [
    { label: "Operator Readiness", value: `${overall.score}/100`, status: toneFromScore(overall.score), detail: overall.rating, updatedAt: timestamp },
    { label: "Managed Hosts", value: String(hosts.length), status: hosts.length ? "Healthy" : "Watch", detail: "Distinct execution hosts in scope", updatedAt: timestamp },
    { label: "Managed Terminals", value: String(terminals.length), status: terminals.length ? "Healthy" : "Watch", detail: "MT5 terminals under operator control", updatedAt: timestamp },
    { label: "Avg Host Pressure Score", value: `${Math.round(avgHostPressure)}/100`, status: toneFromScore(avgHostPressure), detail: "Inverse CPU/memory/disk pressure", updatedAt: timestamp },
    { label: "Avg Terminal Readiness", value: `${Math.round(avgTerminalReadiness)}/100`, status: toneFromScore(avgTerminalReadiness), detail: "Composite terminal operator score", updatedAt: timestamp },
    { label: "Safety Blockers", value: String(criticalWarnings), status: criticalWarnings ? "Critical" : "Healthy", detail: safety.globalKillSwitchActive ? "Kill switch active" : "No global safety blocks", updatedAt: timestamp },
    { label: "Remote Control Lane", value: `${lanes.find((lane) => lane.id === "remote-control")?.readinessScore ?? 0}/100`, status: lanes.find((lane) => lane.id === "remote-control")?.status ?? "Watch", detail: "VPS and session control readiness", updatedAt: timestamp },
    { label: "MT5 Execution Lane", value: `${lanes.find((lane) => lane.id === "mt5-execution")?.readinessScore ?? 0}/100`, status: lanes.find((lane) => lane.id === "mt5-execution")?.status ?? "Watch", detail: "Bridge, router, and queue posture", updatedAt: timestamp }
  ] satisfies OperatorDashboardResponse["kpis"];
}

export function buildOperatorQuickLinks() {
  return [
    { label: "Remote Control Hub", href: "/autonomous-computer-operator/remote-control-hub", description: "VPS, sessions, MT5 launcher, and application health." },
    { label: "Desktop Automation Hub", href: "/autonomous-computer-operator/desktop-automation-hub", description: "Window detection, input simulation, and chart navigation." },
    { label: "Recovery & Safety Hub", href: "/autonomous-computer-operator/recovery-and-safety-hub", description: "Workflow engine, scheduler, kill switch, and operator logs." },
    { label: "Terminal Status", href: "/mt5-infrastructure-and-broker-connectivity/terminal-status", description: "Terminal heartbeat, diagnostics, and restart controls." },
    { label: "EA Bridge", href: "/mt5-infrastructure-and-broker-connectivity/ea-bridge", description: "Secure bridge instances, pairing, and command channels." },
    { label: "Connection Health", href: "/mt5-infrastructure-and-broker-connectivity/connection-health", description: "End-to-end trading path component health." }
  ];
}

export function mapToOperatorDashboardResponse(input: {
  bundle: OperatorTelemetryBundle;
  role: OperatorDashboardResponse["permissions"]["role"];
  highlightedHost: string | null;
}): OperatorDashboardResponse {
  const timestamp = input.bundle.terminalStatus.meta.timestamp;
  const safety = buildOperatorSafetyState(input.bundle);
  const hosts = buildOperatorHostSnapshots(input.bundle);
  const terminals = buildOperatorTerminalRows(input.bundle);
  const lanes = buildOperatorLanes(input.bundle, safety, hosts);
  const overallReadiness = overallOperatorReadinessScore(lanes, safety);
  const workflow = buildOperatorWorkflow(lanes, safety, input.bundle);
  const warnings = buildOperatorWarnings(input.bundle, safety, hosts, terminals);
  const recommendedActions = buildOperatorRecommendedActions(input.bundle, safety, lanes);

  return {
    meta: {
      timestamp,
      currentRole: input.role,
      streamEndpoint: "/api/autonomous-computer-operator/operator-dashboard/events-stream",
      monitoringMode: "Autonomous Computer Operator Command Center",
      highlightedHost: input.highlightedHost,
      overallReadiness
    },
    kpis: buildOperatorKpis(lanes, safety, hosts, terminals, overallReadiness, timestamp),
    safety,
    lanes,
    workflow,
    hosts,
    terminals,
    warnings,
    recommendedActions,
    quickLinks: buildOperatorQuickLinks(),
    permissions: {
      role: input.role,
      canEmergencyStop: ["Super Admin", "Infrastructure Admin", "Trading Admin"].includes(input.role),
      canAutoRemediate: ["Super Admin", "Infrastructure Admin"].includes(input.role),
      canRestartTerminal: ["Super Admin", "Infrastructure Admin"].includes(input.role),
      canManageRemoteControl: ["Super Admin", "Infrastructure Admin", "Trading Admin"].includes(input.role)
    }
  };
}

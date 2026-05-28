import { resourcePressureScore, terminalReadinessScore } from "@/modules/autonomous-computer-operator/operator-dashboard/algorithms/operator-dashboard.algorithms";
import type { BridgeSession, EaInstance } from "@/modules/mt5-infrastructure-and-broker-connectivity/ea-bridge/types/ea-bridge.types";
import type { ConnectionComponent } from "@/modules/mt5-infrastructure-and-broker-connectivity/connection-health/types/connection-health.types";
import type { TerminalStatusRecord } from "@/modules/mt5-infrastructure-and-broker-connectivity/terminal-status/types/terminal-status.types";
import type {
  ApplicationHealthRow,
  ApplicationLauncherRow,
  Mt5AutomationRow,
  RemoteControlCapability,
  RemoteControlHubResponse,
  RemoteControlTelemetryBundle,
  RemoteControlTone,
  RemoteControlWarning,
  RemoteControlWorkflowNode,
  RemoteSessionRow,
  VpsComputerRow
} from "../types/remote-control-hub.types";

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

export function toneFromScore(score: number): RemoteControlTone {
  if (score >= 85) return "Healthy";
  if (score >= 70) return "Watch";
  if (score >= 50) return "Degraded";
  if (score >= 25) return "Critical";
  return "Offline";
}

function hostComponentScore(components: ConnectionComponent[], hostMachine: string) {
  const match = components.find((component) => component.hostMachine === hostMachine && component.componentType === "Host Machine");
  return match?.healthScore ?? 75;
}

export function sessionStabilityScore(session: BridgeSession) {
  let score = 100;
  if (session.status === "Offline") score -= 50;
  else if (session.status === "Critical") score -= 35;
  else if (session.status === "Degraded") score -= 20;
  else if (session.status === "Watch") score -= 10;
  if (session.authStatus === "Rejected") score -= 40;
  else if (session.authStatus === "Expiring") score -= 12;
  if (session.latencyMs > 400) score -= 25;
  else if (session.latencyMs > 250) score -= 15;
  else if (session.latencyMs > 150) score -= 8;
  if (session.messageRatePerMinute < 10 && session.protocol === "WebSocket") score -= 10;
  return clamp(Math.round(score), 0, 100);
}

export function vpsControlScore(
  terminals: TerminalStatusRecord[],
  hostComponents: ConnectionComponent[],
  sessions: BridgeSession[],
  hostMachine: string
) {
  const hostTerminals = terminals.filter((terminal) => terminal.hostMachine === hostMachine);
  if (!hostTerminals.length) return 0;
  const avgReadiness = hostTerminals.reduce((sum, terminal) => sum + terminalReadinessScore(terminal), 0) / hostTerminals.length;
  const avgCpu = hostTerminals.reduce((sum, terminal) => sum + terminal.cpuUsagePercent, 0) / hostTerminals.length;
  const avgMem = hostTerminals.reduce((sum, terminal) => sum + terminal.memoryUsagePercent, 0) / hostTerminals.length;
  const avgDisk = hostTerminals.reduce((sum, terminal) => sum + terminal.diskUsagePercent, 0) / hostTerminals.length;
  const pressure = resourcePressureScore(avgCpu, avgMem, avgDisk);
  const infra = hostComponentScore(hostComponents, hostMachine);
  const sessionCount = sessions.filter((session) => hostTerminals.some((terminal) => terminal.terminalName === session.terminalName)).length;
  const sessionBonus = sessionCount > 0 ? 5 : -8;
  return clamp(Math.round(avgReadiness * 0.45 + pressure * 0.25 + infra * 0.2 + 10 + sessionBonus), 0, 100);
}

export function mt5AutomationReadiness(terminal: TerminalStatusRecord, instance: EaInstance | undefined) {
  let score = terminalReadinessScore(terminal);
  if (!terminal.expertAdvisorsEnabled) score -= 20;
  if (!terminal.tradingEnabled && terminal.accountTradeAllowed) score -= 8;
  if (instance) {
    if (instance.connectionStatus === "Healthy") score += 5;
    else if (instance.connectionStatus === "Critical") score -= 25;
    else if (instance.connectionStatus === "Degraded") score -= 12;
    if (!instance.tradingChannelEnabled) score -= 15;
  } else {
    score -= 18;
  }
  return clamp(Math.round(score), 0, 100);
}

export function launcherReadiness(terminal: TerminalStatusRecord) {
  let score = 80;
  if (terminal.processStatus === "Running") score += 15;
  else if (terminal.processStatus === "Unresponsive") score -= 25;
  else score -= 45;
  if (terminal.maintenanceMode) score -= 20;
  if (terminal.restartRequired) score -= 15;
  if (!terminal.terminalPath) score -= 30;
  return clamp(Math.round(score), 0, 100);
}

export function applicationHealthScore(terminal: TerminalStatusRecord) {
  const pressure = resourcePressureScore(terminal.cpuUsagePercent, terminal.memoryUsagePercent, terminal.diskUsagePercent);
  const latencyPenalty = clamp((terminal.networkLatencyMs - 100) / 10, 0, 15);
  const packetPenalty = clamp(terminal.packetLossPercent * 4, 0, 20);
  return clamp(Math.round(terminal.healthScore * 0.4 + pressure * 0.35 + (100 - latencyPenalty - packetPenalty) * 0.25), 0, 100);
}

export function buildVpsComputerRows(bundle: RemoteControlTelemetryBundle): VpsComputerRow[] {
  const grouped = new Map<string, TerminalStatusRecord[]>();
  for (const terminal of bundle.terminalStatus.terminals) {
    const list = grouped.get(terminal.hostMachine) ?? [];
    list.push(terminal);
    grouped.set(terminal.hostMachine, list);
  }

  return [...grouped.entries()]
    .map(([hostMachine, terminals]) => {
      const controlScore = vpsControlScore(bundle.terminalStatus.terminals, bundle.hostComponents, bundle.eaBridge.sessions, hostMachine);
      const avgCpu = terminals.reduce((sum, terminal) => sum + terminal.cpuUsagePercent, 0) / terminals.length;
      const avgMem = terminals.reduce((sum, terminal) => sum + terminal.memoryUsagePercent, 0) / terminals.length;
      const avgDisk = terminals.reduce((sum, terminal) => sum + terminal.diskUsagePercent, 0) / terminals.length;
      const lastHeartbeatAt = terminals.map((terminal) => terminal.lastHeartbeatAt).sort((a, b) => b.localeCompare(a))[0]!;

      return {
        id: `vps-${hostMachine}`,
        hostMachine,
        region: terminals[0]?.region ?? "Unknown",
        operatingSystem: terminals[0]?.operatingSystem ?? "Unknown",
        ipAddress: terminals[0]?.ipAddress ?? "—",
        terminalCount: terminals.length,
        runningProcesses: terminals.filter((terminal) => terminal.processStatus === "Running").length,
        remoteSessionCount: bundle.eaBridge.sessions.filter((session) => terminals.some((terminal) => terminal.terminalName === session.terminalName)).length,
        controlScore,
        resourcePressureScore: resourcePressureScore(avgCpu, avgMem, avgDisk),
        connectionHealthScore: hostComponentScore(bundle.hostComponents, hostMachine),
        status: toneFromScore(controlScore),
        lastHeartbeatAt
      };
    })
    .sort((left, right) => right.controlScore - left.controlScore);
}

export function buildRemoteSessionRows(bundle: RemoteControlTelemetryBundle): RemoteSessionRow[] {
  return bundle.eaBridge.sessions
    .map((session) => {
      const stabilityScore = sessionStabilityScore(session);
      return {
        id: session.id,
        sessionUuid: session.sessionUuid,
        eaInstanceName: session.eaInstanceName,
        terminalName: session.terminalName,
        accountLogin: session.accountLogin,
        brokerName: session.brokerName,
        protocol: session.protocol,
        authStatus: session.authStatus,
        latencyMs: session.latencyMs,
        messageRatePerMinute: session.messageRatePerMinute,
        sessionDurationSeconds: session.sessionDurationSeconds,
        stabilityScore,
        status: toneFromScore(stabilityScore),
        lastMessageAt: session.lastMessageAt
      };
    })
    .sort((left, right) => right.stabilityScore - left.stabilityScore);
}

export function buildMt5AutomationRows(bundle: RemoteControlTelemetryBundle): Mt5AutomationRow[] {
  const instanceByTerminal = new Map(bundle.eaBridge.instances.map((instance) => [instance.terminalId, instance]));

  return bundle.terminalStatus.terminals
    .map((terminal) => {
      const instance = instanceByTerminal.get(terminal.terminalId);
      const automationScore = mt5AutomationReadiness(terminal, instance);
      return {
        terminalId: terminal.terminalId,
        terminalName: terminal.terminalName,
        hostMachine: terminal.hostMachine,
        accountLogin: terminal.accountLogin,
        brokerName: terminal.brokerName,
        eaInstanceName: instance?.eaName ?? null,
        processStatus: terminal.processStatus,
        expertAdvisorsEnabled: terminal.expertAdvisorsEnabled,
        tradingEnabled: terminal.tradingEnabled,
        bridgeConnected: instance?.connectionStatus === "Healthy",
        automationScore,
        status: toneFromScore(automationScore)
      };
    })
    .sort((left, right) => right.automationScore - left.automationScore);
}

export function buildApplicationLauncherRows(bundle: RemoteControlTelemetryBundle): ApplicationLauncherRow[] {
  return bundle.terminalStatus.terminals
    .map((terminal) => {
      const score = launcherReadiness(terminal);
      return {
        terminalId: terminal.terminalId,
        terminalName: terminal.terminalName,
        hostMachine: terminal.hostMachine,
        terminalPath: terminal.terminalPath,
        processStatus: terminal.processStatus,
        processId: terminal.processId,
        maintenanceMode: terminal.maintenanceMode,
        launcherScore: score,
        status: toneFromScore(score),
        lastStartupAt: terminal.startupTime
      };
    })
    .sort((left, right) => right.launcherScore - left.launcherScore);
}

export function buildApplicationHealthRows(bundle: RemoteControlTelemetryBundle): ApplicationHealthRow[] {
  return bundle.terminalStatus.terminals
    .map((terminal) => {
      const pressureScore = resourcePressureScore(terminal.cpuUsagePercent, terminal.memoryUsagePercent, terminal.diskUsagePercent);
      const score = applicationHealthScore(terminal);
      return {
        terminalId: terminal.terminalId,
        terminalName: terminal.terminalName,
        hostMachine: terminal.hostMachine,
        cpuUsagePercent: terminal.cpuUsagePercent,
        memoryUsagePercent: terminal.memoryUsagePercent,
        diskUsagePercent: terminal.diskUsagePercent,
        networkLatencyMs: terminal.networkLatencyMs,
        packetLossPercent: terminal.packetLossPercent,
        healthScore: terminal.healthScore,
        pressureScore,
        status: toneFromScore(score)
      };
    })
    .sort((left, right) => right.healthScore - left.healthScore);
}

export function buildRemoteControlCapabilities(
  vpsRows: VpsComputerRow[],
  sessions: RemoteSessionRow[],
  automation: Mt5AutomationRow[],
  launchers: ApplicationLauncherRow[],
  healthRows: ApplicationHealthRow[]
): RemoteControlCapability[] {
  const capability = (
    id: RemoteControlCapability["id"],
    title: string,
    score: number,
    activeCount: number,
    blockedCount: number,
    detail: string
  ): RemoteControlCapability => ({
    id,
    title,
    status: toneFromScore(score),
    readinessScore: score,
    activeCount,
    blockedCount,
    detail
  });

  const avg = (values: number[]) => (values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0);

  return [
    capability(
      "computer-control",
      "Computer Control",
      avg(vpsRows.map((row) => row.controlScore)),
      vpsRows.filter((row) => row.status === "Healthy" || row.status === "Watch").length,
      vpsRows.filter((row) => row.status === "Critical" || row.status === "Offline").length,
      "Host reachability and execution machine control posture."
    ),
    capability(
      "vps-control",
      "VPS Control",
      avg(vpsRows.map((row) => row.resourcePressureScore)),
      vpsRows.filter((row) => row.runningProcesses > 0).length,
      vpsRows.filter((row) => row.runningProcesses === 0).length,
      "VPS resource pressure and process availability."
    ),
    capability(
      "remote-session-manager",
      "Remote Session Manager",
      avg(sessions.map((row) => row.stabilityScore)),
      sessions.filter((row) => row.authStatus === "Authenticated").length,
      sessions.filter((row) => row.authStatus === "Rejected" || row.status === "Offline").length,
      "Bridge-backed remote sessions and authentication state."
    ),
    capability(
      "mt5-automation",
      "MT5 Automation",
      avg(automation.map((row) => row.automationScore)),
      automation.filter((row) => row.bridgeConnected && row.expertAdvisorsEnabled).length,
      automation.filter((row) => !row.bridgeConnected || row.processStatus !== "Running").length,
      "Terminal EA linkage and automated execution readiness."
    ),
    capability(
      "application-launcher",
      "Application Launcher",
      avg(launchers.map((row) => row.launcherScore)),
      launchers.filter((row) => row.processStatus === "Running").length,
      launchers.filter((row) => row.processStatus !== "Running").length,
      "MT5 terminal process launch and maintenance posture."
    ),
    capability(
      "application-health",
      "Application Health",
      avg(healthRows.map((row) => row.pressureScore)),
      healthRows.filter((row) => row.status === "Healthy" || row.status === "Watch").length,
      healthRows.filter((row) => row.status === "Critical" || row.status === "Offline").length,
      "CPU, memory, disk, and network health per application host."
    )
  ];
}

export function overallRemoteControlScore(capabilities: RemoteControlCapability[]) {
  const weights: Record<RemoteControlCapability["id"], number> = {
    "computer-control": 0.2,
    "vps-control": 0.15,
    "remote-session-manager": 0.2,
    "mt5-automation": 0.2,
    "application-launcher": 0.1,
    "application-health": 0.15
  };
  const score = clamp(
    Math.round(capabilities.reduce((sum, capability) => sum + capability.readinessScore * (weights[capability.id] ?? 0.15), 0)),
    0,
    100
  );
  const rating = score >= 90 ? "Excellent" : score >= 75 ? "Healthy" : score >= 60 ? "Degraded" : score >= 40 ? "High Risk" : "Critical";
  return { score, rating, factors: capabilities.map((capability) => `${capability.title}: ${capability.readinessScore}`) };
}

export function buildRemoteControlWorkflow(
  capabilities: RemoteControlCapability[],
  vpsRows: VpsComputerRow[],
  sessions: RemoteSessionRow[]
): RemoteControlWorkflowNode[] {
  const step = (title: string, status: RemoteControlTone, assetCount: number, blockedCount: number, detail: string): RemoteControlWorkflowNode => ({
    title,
    status,
    assetCount,
    blockedCount,
    detail
  });

  const computer = capabilities.find((capability) => capability.id === "computer-control")!;
  const session = capabilities.find((capability) => capability.id === "remote-session-manager")!;
  const automation = capabilities.find((capability) => capability.id === "mt5-automation")!;
  const launcher = capabilities.find((capability) => capability.id === "application-launcher")!;

  return [
    step("Host Inventory", computer.status, vpsRows.length, vpsRows.filter((row) => row.status === "Offline").length, "Execution hosts discovered from terminal telemetry."),
    step("VPS Resource Check", capabilities.find((c) => c.id === "vps-control")!.status, vpsRows.length, vpsRows.filter((row) => row.resourcePressureScore < 50).length, "CPU, memory, and disk pressure validated per VPS."),
    step("Remote Session Auth", session.status, sessions.length, sessions.filter((row) => row.authStatus !== "Authenticated").length, "Bridge session authentication and protocol health verified."),
    step("MT5 Process Launch", launcher.status, launcher.activeCount + launcher.blockedCount, launcher.blockedCount, "Terminal processes and launcher paths checked."),
    step("MT5 Automation Link", automation.status, automation.activeCount + automation.blockedCount, automation.blockedCount, "EA bridge linkage and trading channel readiness confirmed."),
    step("Application Health Scan", capabilities.find((c) => c.id === "application-health")!.status, vpsRows.reduce((sum, row) => sum + row.terminalCount, 0), capabilities.find((c) => c.id === "application-health")!.blockedCount, "Per-terminal resource and network health aggregated.")
  ];
}

export function buildRemoteControlWarnings(
  vpsRows: VpsComputerRow[],
  sessions: RemoteSessionRow[],
  automation: Mt5AutomationRow[],
  launchers: ApplicationLauncherRow[]
): RemoteControlWarning[] {
  const warnings: RemoteControlWarning[] = [];

  for (const host of vpsRows.filter((row) => row.controlScore < 50)) {
    warnings.push({
      id: `warn-vps-${host.hostMachine}`,
      severity: host.controlScore < 30 ? "Critical" : "Degraded",
      category: "VPS Control",
      title: `${host.hostMachine} control degraded`,
      detail: `Control score ${host.controlScore}/100 · ${host.runningProcesses}/${host.terminalCount} processes running`
    });
  }

  for (const session of sessions.filter((row) => row.authStatus === "Rejected" || row.stabilityScore < 40)) {
    warnings.push({
      id: `warn-session-${session.id}`,
      severity: session.authStatus === "Rejected" ? "Critical" : "Watch",
      category: "Remote Session",
      title: `${session.terminalName} session unstable`,
      detail: `${session.protocol} · ${session.authStatus} · latency ${session.latencyMs}ms`
    });
  }

  for (const row of automation.filter((item) => !item.bridgeConnected || item.processStatus !== "Running")) {
    warnings.push({
      id: `warn-auto-${row.terminalId}`,
      severity: row.processStatus === "Stopped" ? "Critical" : "Degraded",
      category: "MT5 Automation",
      title: `${row.terminalName} automation blocked`,
      detail: `${row.accountLogin} · EA ${row.eaInstanceName ?? "not linked"} · process ${row.processStatus}`
    });
  }

  for (const launcher of launchers.filter((row) => row.maintenanceMode || row.launcherScore < 45)) {
    warnings.push({
      id: `warn-launcher-${launcher.terminalId}`,
      severity: launcher.launcherScore < 30 ? "Critical" : "Watch",
      category: "Application Launcher",
      title: `${launcher.terminalName} launcher attention`,
      detail: launcher.maintenanceMode ? "Terminal in maintenance mode." : `Launcher score ${launcher.launcherScore}/100`
    });
  }

  return warnings.slice(0, 14);
}

export function buildRemoteControlKpis(
  capabilities: RemoteControlCapability[],
  vpsRows: VpsComputerRow[],
  sessions: RemoteSessionRow[],
  overall: RemoteControlHubResponse["meta"]["overallReadiness"],
  timestamp: string
) {
  const hostsOnline = vpsRows.filter((row) => row.status !== "Offline").length;
  const authenticatedSessions = sessions.filter((row) => row.authStatus === "Authenticated").length;

  return [
    { label: "Remote Control Readiness", value: `${overall.score}/100`, status: toneFromScore(overall.score), detail: overall.rating, updatedAt: timestamp },
    { label: "Managed Hosts", value: String(vpsRows.length), status: vpsRows.length ? "Healthy" : "Watch", detail: "VPS and execution computers", updatedAt: timestamp },
    { label: "Hosts Online", value: String(hostsOnline), status: hostsOnline === vpsRows.length ? "Healthy" : "Degraded", detail: "Reachable control targets", updatedAt: timestamp },
    { label: "Remote Sessions", value: String(sessions.length), status: sessions.length ? "Healthy" : "Watch", detail: "Active bridge-backed sessions", updatedAt: timestamp },
    { label: "Authenticated Sessions", value: String(authenticatedSessions), status: authenticatedSessions === sessions.length ? "Healthy" : "Degraded", detail: "Sessions passing auth checks", updatedAt: timestamp },
    { label: "MT5 Automation Ready", value: String(capabilities.find((c) => c.id === "mt5-automation")?.activeCount ?? 0), status: toneFromScore(capabilities.find((c) => c.id === "mt5-automation")?.readinessScore ?? 0), detail: "EA-linked running terminals", updatedAt: timestamp },
    { label: "Apps Running", value: String(capabilities.find((c) => c.id === "application-launcher")?.activeCount ?? 0), status: toneFromScore(capabilities.find((c) => c.id === "application-launcher")?.readinessScore ?? 0), detail: "MT5 terminal processes online", updatedAt: timestamp },
    { label: "Application Health", value: `${capabilities.find((c) => c.id === "application-health")?.readinessScore ?? 0}/100`, status: toneFromScore(capabilities.find((c) => c.id === "application-health")?.readinessScore ?? 0), detail: "Aggregate application health score", updatedAt: timestamp }
  ] satisfies RemoteControlHubResponse["kpis"];
}

export function buildRemoteControlQuickLinks() {
  return [
    { label: "Operator Dashboard", href: "/autonomous-computer-operator/operator-dashboard", description: "Cross-lane operator readiness and safety overview." },
    { label: "Terminal Status", href: "/mt5-infrastructure-and-broker-connectivity/terminal-status", description: "Heartbeat, diagnostics, and terminal restart controls." },
    { label: "EA Bridge", href: "/mt5-infrastructure-and-broker-connectivity/ea-bridge", description: "Remote session pairing and bridge instance management." },
    { label: "Connection Health", href: "/mt5-infrastructure-and-broker-connectivity/connection-health", description: "Host machine and infrastructure component health." },
    { label: "Desktop Automation Hub", href: "/autonomous-computer-operator/desktop-automation-hub", description: "Window detection and input simulation." },
    { label: "Recovery & Safety Hub", href: "/autonomous-computer-operator/recovery-and-safety-hub", description: "Kill switch and recovery workflows (planned)." }
  ];
}

export function mapToRemoteControlHubResponse(input: {
  bundle: RemoteControlTelemetryBundle;
  role: RemoteControlHubResponse["permissions"]["role"];
  highlightedHost: string | null;
}): RemoteControlHubResponse {
  const timestamp = input.bundle.terminalStatus.meta.timestamp;
  const vpsComputers = buildVpsComputerRows(input.bundle);
  const remoteSessions = buildRemoteSessionRows(input.bundle);
  const mt5Automation = buildMt5AutomationRows(input.bundle);
  const applicationLaunchers = buildApplicationLauncherRows(input.bundle);
  const applicationHealth = buildApplicationHealthRows(input.bundle);
  const capabilities = buildRemoteControlCapabilities(vpsComputers, remoteSessions, mt5Automation, applicationLaunchers, applicationHealth);
  const overallReadiness = overallRemoteControlScore(capabilities);

  return {
    meta: {
      timestamp,
      currentRole: input.role,
      streamEndpoint: "/api/autonomous-computer-operator/remote-control-hub/events-stream",
      monitoringMode: "Remote Control & Session Command Hub",
      highlightedHost: input.highlightedHost,
      overallReadiness
    },
    kpis: buildRemoteControlKpis(capabilities, vpsComputers, remoteSessions, overallReadiness, timestamp),
    capabilities,
    workflow: buildRemoteControlWorkflow(capabilities, vpsComputers, remoteSessions),
    vpsComputers,
    remoteSessions,
    mt5Automation,
    applicationLaunchers,
    applicationHealth,
    warnings: buildRemoteControlWarnings(vpsComputers, remoteSessions, mt5Automation, applicationLaunchers),
    quickLinks: buildRemoteControlQuickLinks(),
    permissions: {
      role: input.role,
      canRestartTerminal: ["Super Admin", "Infrastructure Admin"].includes(input.role),
      canManageSessions: ["Super Admin", "Infrastructure Admin", "Trading Admin"].includes(input.role),
      canLaunchApplication: ["Super Admin", "Infrastructure Admin"].includes(input.role),
      canRunDiagnostics: ["Super Admin", "Infrastructure Admin", "Analyst"].includes(input.role)
    }
  };
}

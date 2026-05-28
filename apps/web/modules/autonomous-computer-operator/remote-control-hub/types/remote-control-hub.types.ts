import type { Mt5Role, ScoreResult } from "@/modules/mt5-infrastructure-and-broker-connectivity/mt5-control-center/types/mt5-control-center.types";
import type { BridgeSession } from "@/modules/mt5-infrastructure-and-broker-connectivity/ea-bridge/types/ea-bridge.types";
import type { ConnectionComponent } from "@/modules/mt5-infrastructure-and-broker-connectivity/connection-health/types/connection-health.types";
import type { TerminalStatusRecord } from "@/modules/mt5-infrastructure-and-broker-connectivity/terminal-status/types/terminal-status.types";
import type { EaBridgeResponse } from "@/modules/mt5-infrastructure-and-broker-connectivity/ea-bridge/types/ea-bridge.types";
import type { ConnectionHealthSummaryResponse } from "@/modules/mt5-infrastructure-and-broker-connectivity/connection-health/types/connection-health.types";
import type { TerminalStatusResponse } from "@/modules/mt5-infrastructure-and-broker-connectivity/terminal-status/types/terminal-status.types";

export type RemoteControlTone = "Healthy" | "Watch" | "Degraded" | "Critical" | "Offline" | "Syncing" | "Inactive";

export type RemoteControlCapabilityId =
  | "computer-control"
  | "vps-control"
  | "remote-session-manager"
  | "mt5-automation"
  | "application-launcher"
  | "application-health";

export type RemoteControlCapability = {
  id: RemoteControlCapabilityId;
  title: string;
  status: RemoteControlTone;
  readinessScore: number;
  activeCount: number;
  blockedCount: number;
  detail: string;
};

export type VpsComputerRow = {
  id: string;
  hostMachine: string;
  region: string;
  operatingSystem: string;
  ipAddress: string;
  terminalCount: number;
  runningProcesses: number;
  remoteSessionCount: number;
  controlScore: number;
  resourcePressureScore: number;
  connectionHealthScore: number;
  status: RemoteControlTone;
  lastHeartbeatAt: string;
};

export type RemoteSessionRow = {
  id: string;
  sessionUuid: string;
  eaInstanceName: string;
  terminalName: string;
  accountLogin: string;
  brokerName: string;
  protocol: BridgeSession["protocol"];
  authStatus: BridgeSession["authStatus"];
  latencyMs: number;
  messageRatePerMinute: number;
  sessionDurationSeconds: number;
  stabilityScore: number;
  status: RemoteControlTone;
  lastMessageAt: string;
};

export type Mt5AutomationRow = {
  terminalId: string;
  terminalName: string;
  hostMachine: string;
  accountLogin: string;
  brokerName: string;
  eaInstanceName: string | null;
  processStatus: TerminalStatusRecord["processStatus"];
  expertAdvisorsEnabled: boolean;
  tradingEnabled: boolean;
  bridgeConnected: boolean;
  automationScore: number;
  status: RemoteControlTone;
};

export type ApplicationLauncherRow = {
  terminalId: string;
  terminalName: string;
  hostMachine: string;
  terminalPath: string;
  processStatus: TerminalStatusRecord["processStatus"];
  processId: number | null;
  maintenanceMode: boolean;
  launcherScore: number;
  status: RemoteControlTone;
  lastStartupAt: string;
};

export type ApplicationHealthRow = {
  terminalId: string;
  terminalName: string;
  hostMachine: string;
  cpuUsagePercent: number;
  memoryUsagePercent: number;
  diskUsagePercent: number;
  networkLatencyMs: number;
  packetLossPercent: number;
  healthScore: number;
  pressureScore: number;
  status: RemoteControlTone;
};

export type RemoteControlWarning = {
  id: string;
  severity: RemoteControlTone;
  category: string;
  title: string;
  detail: string;
};

export type RemoteControlWorkflowNode = {
  title: string;
  status: RemoteControlTone;
  assetCount: number;
  blockedCount: number;
  detail: string;
};

export type RemoteControlTelemetryBundle = {
  terminalStatus: TerminalStatusResponse;
  eaBridge: EaBridgeResponse;
  connectionSummary: ConnectionHealthSummaryResponse;
  hostComponents: ConnectionComponent[];
};

export type RemoteControlHubResponse = {
  meta: {
    timestamp: string;
    currentRole: Mt5Role;
    streamEndpoint: string;
    monitoringMode: string;
    highlightedHost: string | null;
    overallReadiness: ScoreResult;
  };
  kpis: Array<{ label: string; value: string; status: RemoteControlTone; detail: string; updatedAt: string }>;
  capabilities: RemoteControlCapability[];
  workflow: RemoteControlWorkflowNode[];
  vpsComputers: VpsComputerRow[];
  remoteSessions: RemoteSessionRow[];
  mt5Automation: Mt5AutomationRow[];
  applicationLaunchers: ApplicationLauncherRow[];
  applicationHealth: ApplicationHealthRow[];
  warnings: RemoteControlWarning[];
  quickLinks: Array<{ label: string; href: string; description: string }>;
  permissions: {
    role: Mt5Role;
    canRestartTerminal: boolean;
    canManageSessions: boolean;
    canLaunchApplication: boolean;
    canRunDiagnostics: boolean;
  };
};

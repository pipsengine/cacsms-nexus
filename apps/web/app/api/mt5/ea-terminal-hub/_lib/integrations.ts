import "server-only";

import type { Mt5Role } from "@/modules/mt5-infrastructure-and-broker-connectivity/mt5-control-center/types/mt5-control-center.types";
import {
  resolveConnectionFromBridge,
  resolveConnectionFromMonitor,
  riskFromHealth
} from "@/modules/mt5-infrastructure-and-broker-connectivity/ea-terminal-hub/algorithms/ea-terminal-hub.algorithms";
import type { Mt5TerminalLink } from "@/modules/mt5-infrastructure-and-broker-connectivity/ea-terminal-hub/types/ea-terminal-hub.types";
import { bridgeInstances } from "../../ea-bridge/_lib/store";
import { terminalRecords } from "../../terminal-status/_lib/store";
import { deriveMt5DataRoot, deriveMt5ExpertsPath, deriveMt5IncludePath, resolveCacsmsEaRoot } from "./paths";

function bridgeForTerminal(terminalId: string) {
  return bridgeInstances().find((instance) => instance.terminalId === terminalId) ?? null;
}

function monitorForTerminal(terminalId: string) {
  return terminalRecords().find((terminal) => terminal.terminalId === terminalId) ?? null;
}

export function mergeTerminalLiveState(terminal: Mt5TerminalLink): Mt5TerminalLink {
  const bridge = bridgeForTerminal(terminal.terminalId);
  const monitor = monitorForTerminal(terminal.terminalId);

  if (monitor?.terminalPath && monitor.terminalPath !== "Pending terminal installation") {
    terminal.terminalExecutablePath = monitor.terminalPath;
    terminal.mt5DataRoot = deriveMt5DataRoot(monitor.terminalPath);
    terminal.mt5ExpertsPath = deriveMt5ExpertsPath(monitor.terminalPath);
    terminal.mt5IncludePath = deriveMt5IncludePath(monitor.terminalPath);
    terminal.terminalUuid = monitor.terminalUuid;
    terminal.hostMachine = monitor.hostMachine;
    terminal.region = monitor.region;
    terminal.brokerName = monitor.brokerName;
    terminal.accountLogin = monitor.accountLogin;
    terminal.terminalName = monitor.terminalName;
  }

  if (bridge) {
    terminal.eaInstanceId = bridge.id;
    terminal.bridgeChannelId = bridge.id;
    terminal.bridgeHeartbeatStatus = bridge.heartbeatStatus;
    terminal.lastHeartbeatAt = bridge.lastHeartbeatAt;
    terminal.connectionStatus = resolveConnectionFromBridge(bridge.heartbeatStatus);
    terminal.healthScore = Math.round((terminal.healthScore + bridgeHealthNumeric(bridge.heartbeatStatus)) / 2);
    terminal.riskLevel = riskFromHealth(terminal.healthScore);
  } else if (monitor) {
    terminal.lastHeartbeatAt = monitor.lastHeartbeatAt;
    terminal.connectionStatus = resolveConnectionFromMonitor(monitor.heartbeatStatus, monitor.processStatus);
    terminal.healthScore = Math.round((terminal.healthScore + monitor.healthScore) / 2);
    terminal.riskLevel = monitor.riskLevel;
  }

  return terminal;
}

function bridgeHealthNumeric(status: string) {
  if (status === "Healthy") return 96;
  if (status === "Watch") return 78;
  if (status === "Degraded") return 62;
  if (status === "Critical") return 35;
  return 20;
}

export function syncTerminalProfilesFromInfrastructure(existing: Mt5TerminalLink[]): Mt5TerminalLink[] {
  const byId = new Map(existing.map((terminal) => [terminal.terminalId, terminal]));
  for (const monitor of terminalRecords()) {
    const current = byId.get(monitor.terminalId);
    if (current) continue;

    const terminalPath = monitor.terminalPath !== "Pending terminal installation" ? monitor.terminalPath : "";
    byId.set(
      monitor.terminalId,
      createTerminalLinkFromMonitor(monitor.terminalId, monitor.terminalUuid, monitor.terminalName, monitor.brokerName, monitor.accountLogin, monitor.hostMachine, monitor.region, terminalPath)
    );
  }
  return [...byId.values()];
}

export function createTerminalLinkFromMonitor(
  terminalId: string,
  terminalUuid: string,
  terminalName: string,
  brokerName: string,
  accountLogin: string,
  hostMachine: string,
  region: string,
  terminalExecutablePath: string
): Mt5TerminalLink {
  const executable = terminalExecutablePath || "C:\\MT5\\Pending\\terminal64.exe";
  return {
    terminalId,
    terminalUuid,
    terminalName,
    brokerName,
    accountLogin,
    hostMachine,
    region,
    terminalExecutablePath: executable,
    mt5DataRoot: deriveMt5DataRoot(executable),
    mt5ExpertsPath: deriveMt5ExpertsPath(executable),
    mt5IncludePath: deriveMt5IncludePath(executable),
    connectionStatus: "Disconnected",
    linkStatus: "Not Linked",
    cacsmsEaRoot: resolveCacsmsEaRoot(),
    linkedAt: null,
    lastConnectedAt: null,
    lastSyncAt: null,
    lastHeartbeatAt: null,
    healthScore: 72,
    riskLevel: "Watch",
    autoLinkOnConnect: true,
    operatorManaged: false,
    isActive: false,
    driftFileCount: 0,
    missingInMt5Count: 0,
    missingInSystemCount: 0,
    hashMismatchCount: 0,
    bridgeChannelId: null,
    eaInstanceId: null,
    bridgeHeartbeatStatus: null,
    notes: "Provisioned from terminal-status monitor."
  };
}

export function applyLiveStateToTerminals(terminals: Mt5TerminalLink[]) {
  return terminals.map((terminal) => mergeTerminalLiveState({ ...terminal }));
}

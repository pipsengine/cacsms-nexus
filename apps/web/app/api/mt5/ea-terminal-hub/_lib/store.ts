import "server-only";

import type { AuditRecord, Mt5Role } from "@/modules/mt5-infrastructure-and-broker-connectivity/mt5-control-center/types/mt5-control-center.types";
import {
  buildWorkflow,
  compareEaFolders,
  linkHealthScore,
  resolveLinkStatus,
  riskFromHealth
} from "@/modules/mt5-infrastructure-and-broker-connectivity/ea-terminal-hub/algorithms/ea-terminal-hub.algorithms";
import { createEaTerminalHubSeed } from "@/modules/mt5-infrastructure-and-broker-connectivity/ea-terminal-hub/data/ea-terminal-hub.mock";
import type {
  ActionResponse,
  ConnectTerminalsRequest,
  EaTerminalHubResponse,
  EaTerminalHubSummary,
  FolderDriftItem,
  LinkFolderRequest,
  Mt5TerminalLink
} from "@/modules/mt5-infrastructure-and-broker-connectivity/ea-terminal-hub/types/ea-terminal-hub.types";
import { resolveMt5Role } from "../../_lib/access";
import { bindPersistedMt5State } from "../../_lib/persistence";

import { copyLinkedEaFiles, scanCacsmsEaFolder, scanMt5ExpertsFolder } from "./fs";
import { deriveMt5DataRoot, deriveMt5ExpertsPath, resolveCacsmsEaRoot } from "./paths";

const seed = createEaTerminalHubSeed();

const state = bindPersistedMt5State("ea-terminal-hub", () => ({
  terminals: seed.terminals,
  activeTerminalId: seed.activeTerminalId,
  systemFolder: null as Awaited<ReturnType<typeof scanCacsmsEaFolder>> | null,
  drift: [] as FolderDriftItem[],
  audits: [] as AuditRecord[],
  lastUpdatedAt: new Date().toISOString()
}));

const permissions: Record<string, Mt5Role[]> = {
  scan: ["Super Admin", "Infrastructure Admin", "Trading Admin", "Analyst"],
  connect: ["Super Admin", "Infrastructure Admin", "Trading Admin"],
  disconnect: ["Super Admin", "Infrastructure Admin", "Trading Admin"],
  link: ["Super Admin", "Infrastructure Admin"],
  setActive: ["Super Admin", "Infrastructure Admin", "Trading Admin", "Analyst"],
  syncAll: ["Super Admin", "Infrastructure Admin"]
};

export function eaTerminalHubRole(request?: Request): Mt5Role {
  return resolveMt5Role(request);
}

function authorize(role: Mt5Role, action: keyof typeof permissions) {
  if (!permissions[action].includes(role)) {
    throw new Error(`Role "${role}" is not authorized to perform EA terminal hub ${action}.`);
  }
}

function confirm(confirmed?: boolean) {
  if (!confirmed) throw new Error("Confirmation is required for this restricted EA terminal hub action.");
}

function audit(role: Mt5Role, action: string, entityId: string, oldValue: unknown, newValue: unknown, request?: Request) {
  state.audits.unshift({
    id: `ea-hub-audit-${Date.now()}-${state.audits.length}`,
    userId: request?.headers.get("x-user-id") ?? role.toLowerCase().replace(/\s+/g, "-"),
    action,
    module: "EA & Terminal Hub",
    entityId,
    oldValue,
    newValue,
    ipAddress: request?.headers.get("x-forwarded-for") ?? "system",
    userAgent: request?.headers.get("user-agent") ?? "ea-terminal-hub",
    timestamp: new Date().toISOString()
  });
}

function terminalById(terminalId: string) {
  const terminal = state.terminals.find((item) => item.terminalId === terminalId);
  if (!terminal) throw new Error("MT5 terminal profile not found.");
  return terminal;
}

async function refreshSystemFolder() {
  state.systemFolder = await scanCacsmsEaFolder();
  return state.systemFolder;
}

async function refreshTerminalLink(terminal: Mt5TerminalLink) {
  const system = state.systemFolder ?? (await refreshSystemFolder());
  const mt5 = await scanMt5ExpertsFolder(terminal.mt5ExpertsPath);
  const comparison = compareEaFolders(system.files, mt5.files);
  terminal.driftFileCount = comparison.drift.filter((item) => item.status !== "Synced").length;
  terminal.missingInMt5Count = comparison.missingInMt5;
  terminal.missingInSystemCount = comparison.missingInSystem;
  terminal.linkStatus = resolveLinkStatus(mt5.exists, comparison.missingInMt5, comparison.missingInSystem, comparison.mismatches, terminal.linkedAt);
  terminal.lastSyncAt = new Date().toISOString();
  terminal.cacsmsEaRoot = system.root;
  return comparison;
}

async function refreshAllDrift(activeTerminalId?: string | null) {
  const focusId = activeTerminalId ?? state.activeTerminalId;
  if (!focusId) {
    state.drift = [];
    return;
  }
  const comparison = await refreshTerminalLink(terminalById(focusId));
  state.drift = comparison.drift;
}

function buildSummary(): EaTerminalHubSummary {
  const system = state.systemFolder;
  return {
    cacsmsEaRoot: system?.root ?? resolveCacsmsEaRoot(),
    systemFolder: system ?? {
      root: resolveCacsmsEaRoot(),
      expertsPath: resolveCacsmsEaRoot(),
      exists: false,
      files: [],
      fileCount: 0,
      lastScannedAt: state.lastUpdatedAt,
      lastModifiedAt: null
    },
    totalTerminals: state.terminals.length,
    connectedTerminals: state.terminals.filter((t) => t.connectionStatus === "Connected").length,
    linkedTerminals: state.terminals.filter((t) => t.linkStatus === "Linked").length,
    driftedTerminals: state.terminals.filter((t) => t.linkStatus === "Drifted").length,
    activeTerminalId: state.activeTerminalId,
    linkHealthScore: linkHealthScore(state.terminals),
    lastUpdatedAt: state.lastUpdatedAt
  };
}

export async function buildEaTerminalHubResponse(role: Mt5Role): Promise<EaTerminalHubResponse> {
  await refreshSystemFolder();
  await refreshAllDrift();
  state.lastUpdatedAt = new Date().toISOString();
  return {
    meta: {
      timestamp: state.lastUpdatedAt,
      currentRole: role,
      streamEndpoint: "/api/mt5/ea-terminal-hub/events-stream"
    },
    summary: buildSummary(),
    terminals: state.terminals,
    drift: state.drift,
    workflow: buildWorkflow(state.terminals),
    audits: state.audits
  };
}

export function summary(role: Mt5Role) {
  return buildSummary();
}

export async function scanFolders(role: Mt5Role, request?: Request) {
  authorize(role, "scan");
  await refreshSystemFolder();
  for (const terminal of state.terminals) {
    await refreshTerminalLink(terminal);
  }
  await refreshAllDrift();
  state.lastUpdatedAt = new Date().toISOString();
  audit(role, "EA folders scanned", "all", null, buildSummary(), request);
  return { ok: true, message: "System and MT5 EA folders scanned.", summary: buildSummary() } satisfies ActionResponse;
}

export async function connectTerminals(payload: ConnectTerminalsRequest, role: Mt5Role, request?: Request) {
  authorize(role, "connect");
  confirm(payload.confirmed);
  const updated: Mt5TerminalLink[] = [];

  for (const terminalId of payload.terminalIds) {
    const terminal = terminalById(terminalId);
    const oldStatus = terminal.connectionStatus;
    terminal.connectionStatus = "Connecting";
    terminal.connectionStatus = "Connected";
    terminal.lastConnectedAt = new Date().toISOString();
    terminal.bridgeChannelId = `bridge-${terminal.terminalId}`;
    terminal.healthScore = Math.min(100, terminal.healthScore + 4);
    terminal.riskLevel = riskFromHealth(terminal.healthScore);
    if (payload.autoLink ?? terminal.autoLinkOnConnect) {
      await linkTerminalFolder({ terminalId, confirmed: true }, role, request, terminal);
    }
    audit(role, "Terminal connected", terminalId, oldStatus, terminal.connectionStatus, request);
    updated.push(terminal);
  }

  if (!state.activeTerminalId && updated[0]) {
    state.activeTerminalId = updated[0].terminalId;
    state.terminals.forEach((t) => {
      t.isActive = t.terminalId === state.activeTerminalId;
    });
  }

  state.lastUpdatedAt = new Date().toISOString();
  await refreshAllDrift();
  return { ok: true, message: `${updated.length} terminal(s) connected.`, terminals: updated, summary: buildSummary() } satisfies ActionResponse;
}

export function disconnectTerminals(terminalIds: string[], role: Mt5Role, confirmed: boolean, request?: Request) {
  authorize(role, "disconnect");
  confirm(confirmed);
  const updated: Mt5TerminalLink[] = [];
  for (const terminalId of terminalIds) {
    const terminal = terminalById(terminalId);
    const oldStatus = terminal.connectionStatus;
    terminal.connectionStatus = "Disconnected";
    terminal.bridgeChannelId = null;
    if (state.activeTerminalId === terminalId) {
      const fallback = state.terminals.find((t) => t.connectionStatus === "Connected" && t.terminalId !== terminalId);
      state.activeTerminalId = fallback?.terminalId ?? null;
      state.terminals.forEach((t) => {
        t.isActive = t.terminalId === state.activeTerminalId;
      });
    }
    audit(role, "Terminal disconnected", terminalId, oldStatus, terminal.connectionStatus, request);
    updated.push(terminal);
  }
  state.lastUpdatedAt = new Date().toISOString();
  return { ok: true, message: `${updated.length} terminal(s) disconnected.`, terminals: updated, summary: buildSummary() } satisfies ActionResponse;
}

export async function linkTerminalFolder(
  payload: LinkFolderRequest,
  role: Mt5Role,
  request?: Request,
  existingTerminal?: Mt5TerminalLink
) {
  authorize(role, "link");
  confirm(payload.confirmed);
  const terminal = existingTerminal ?? terminalById(payload.terminalId);
  const system = state.systemFolder ?? (await refreshSystemFolder());
  const fileNames = payload.fileNames?.length ? payload.fileNames : system.files.map((file) => file.name);
  const copied = await copyLinkedEaFiles(terminal.mt5ExpertsPath, fileNames);
  terminal.linkedAt = new Date().toISOString();
  terminal.mt5ExpertsPath = deriveMt5ExpertsPath(terminal.terminalExecutablePath);
  terminal.mt5DataRoot = deriveMt5DataRoot(terminal.terminalExecutablePath);
  await refreshTerminalLink(terminal);
  if (state.activeTerminalId === terminal.terminalId) {
    await refreshAllDrift(terminal.terminalId);
  }
  audit(role, "EA folder linked", terminal.terminalId, null, { copied, path: terminal.mt5ExpertsPath }, request);
  state.lastUpdatedAt = new Date().toISOString();
  return {
    ok: true,
    message: `Linked ${copied.length} EA file(s) to ${terminal.terminalName}.`,
    terminal,
    copiedFiles: copied,
    summary: buildSummary()
  } satisfies ActionResponse;
}

export async function setActiveTerminal(terminalId: string, role: Mt5Role, request?: Request) {
  authorize(role, "setActive");
  terminalById(terminalId);
  state.activeTerminalId = terminalId;
  state.terminals.forEach((terminal) => {
    terminal.isActive = terminal.terminalId === terminalId;
  });
  await refreshAllDrift(terminalId);
  audit(role, "Active terminal changed", terminalId, null, terminalId, request);
  state.lastUpdatedAt = new Date().toISOString();
  return { ok: true, message: "Active terminal updated.", terminal: terminalById(terminalId), summary: buildSummary() } satisfies ActionResponse;
}

export async function syncAllTerminalFolders(role: Mt5Role, confirmed: boolean, request?: Request) {
  authorize(role, "syncAll");
  confirm(confirmed);
  const connected = state.terminals.filter((t) => t.connectionStatus === "Connected");
  for (const terminal of connected) {
    await linkTerminalFolder({ terminalId: terminal.terminalId, confirmed: true }, role, request, terminal);
  }
  state.lastUpdatedAt = new Date().toISOString();
  audit(role, "All connected terminals synced", "all", null, { count: connected.length }, request);
  return { ok: true, message: `Synchronized ${connected.length} connected terminal EA folder(s).`, summary: buildSummary() } satisfies ActionResponse;
}

export function registerTerminal(payload: {
  terminalName: string;
  terminalExecutablePath: string;
  brokerName: string;
  accountLogin: string;
  hostMachine: string;
  region: string;
}, role: Mt5Role, request?: Request) {
  authorize(role, "connect");
  const terminalId = `term-custom-${Date.now()}`;
  const terminal: Mt5TerminalLink = {
    terminalId,
    terminalName: payload.terminalName,
    brokerName: payload.brokerName,
    accountLogin: payload.accountLogin,
    hostMachine: payload.hostMachine,
    region: payload.region,
    terminalExecutablePath: payload.terminalExecutablePath,
    mt5DataRoot: deriveMt5DataRoot(payload.terminalExecutablePath),
    mt5ExpertsPath: deriveMt5ExpertsPath(payload.terminalExecutablePath),
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
    isActive: false,
    driftFileCount: 0,
    missingInMt5Count: 0,
    missingInSystemCount: 0,
    bridgeChannelId: null,
    notes: "Custom terminal profile"
  };
  state.terminals.unshift(terminal);
  audit(role, "Terminal profile registered", terminalId, null, terminal, request);
  state.lastUpdatedAt = new Date().toISOString();
  return { ok: true, message: "Terminal profile registered.", terminal, summary: buildSummary() } satisfies ActionResponse;
}

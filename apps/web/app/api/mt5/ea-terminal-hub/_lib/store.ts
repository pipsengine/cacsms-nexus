import "server-only";

import type { AuditRecord, Mt5Role, Terminal } from "@/modules/mt5-infrastructure-and-broker-connectivity/mt5-control-center/types/mt5-control-center.types";
import {
  buildInstallChecklist,
  buildWorkflow,
  compareEaFolders,
  linkHealthScore,
  resolveLinkStatus,
  riskFromHealth,
  validateTerminalRegistration
} from "@/modules/mt5-infrastructure-and-broker-connectivity/ea-terminal-hub/algorithms/ea-terminal-hub.algorithms";
import { createEaTerminalHubSeed } from "@/modules/mt5-infrastructure-and-broker-connectivity/ea-terminal-hub/data/ea-terminal-hub.mock";
import type {
  ActionResponse,
  ConnectTerminalsRequest,
  EaTerminalHubPermissions,
  EaTerminalHubResponse,
  EaTerminalHubSummary,
  FolderDriftItem,
  LinkFolderRequest,
  Mt5TerminalLink
} from "@/modules/mt5-infrastructure-and-broker-connectivity/ea-terminal-hub/types/ea-terminal-hub.types";
import { resolveMt5Role } from "../../_lib/access";
import { bindPersistedMt5State } from "../../_lib/persistence";

import {
  applyLiveStateToTerminals,
  createTerminalLinkFromMonitor,
  mergeTerminalLiveState,
  syncTerminalProfilesFromInfrastructure
} from "./integrations";
import { copyAllLinkedEaArtifacts, copyLinkedEaFiles, previewLinkedEaSync, scanCacsmsEaFolder, scanMt5ExpertsFolder, validateTerminalExecutable } from "./fs";
import { deriveMt5DataRoot, deriveMt5ExpertsPath, deriveMt5IncludePath, resolveCacsmsEaRoot } from "./paths";

const seed = createEaTerminalHubSeed();

const state = bindPersistedMt5State("ea-terminal-hub", () => ({
  terminals: seed.terminals,
  activeTerminalId: seed.activeTerminalId,
  systemFolder: null as Awaited<ReturnType<typeof scanCacsmsEaFolder>> | null,
  drift: [] as FolderDriftItem[],
  audits: [] as AuditRecord[],
  lastUpdatedAt: new Date().toISOString()
}));

export function resetEaTerminalHubState(override?: ReturnType<typeof createEaTerminalHubSeed>) {
  const next = override ?? createEaTerminalHubSeed();
  state.terminals = next.terminals;
  state.activeTerminalId = next.activeTerminalId;
  state.systemFolder = null;
  state.drift = [];
  state.audits = [];
  state.lastUpdatedAt = new Date().toISOString();
}

const permissions: Record<string, Mt5Role[]> = {
  scan: ["Super Admin", "Infrastructure Admin", "Trading Admin", "Analyst"],
  connect: ["Super Admin", "Infrastructure Admin", "Trading Admin"],
  disconnect: ["Super Admin", "Infrastructure Admin", "Trading Admin"],
  link: ["Super Admin", "Infrastructure Admin"],
  setActive: ["Super Admin", "Infrastructure Admin", "Trading Admin", "Analyst"],
  syncAll: ["Super Admin", "Infrastructure Admin"],
  register: ["Super Admin", "Infrastructure Admin", "Trading Admin"],
  previewSync: ["Super Admin", "Infrastructure Admin", "Trading Admin", "Analyst"]
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

function buildPermissions(role: Mt5Role): EaTerminalHubPermissions {
  return {
    role,
    canScan: permissions.scan.includes(role),
    canConnect: permissions.connect.includes(role),
    canDisconnect: permissions.disconnect.includes(role),
    canLink: permissions.link.includes(role),
    canSyncAll: permissions.syncAll.includes(role),
    canSetActive: permissions.setActive.includes(role),
    canRegister: permissions.register.includes(role),
    canPreviewSync: permissions.previewSync.includes(role)
  };
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

function hydrateTerminalProfiles() {
  state.terminals = syncTerminalProfilesFromInfrastructure(state.terminals);
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
  terminal.hashMismatchCount = comparison.hashMismatches;
  terminal.linkStatus = resolveLinkStatus(
    mt5.exists,
    comparison.missingInMt5,
    comparison.missingInSystem,
    comparison.mismatches,
    comparison.hashMismatches,
    terminal.linkedAt
  );
  terminal.lastSyncAt = new Date().toISOString();
  terminal.cacsmsEaRoot = system.root;
  terminal.mt5IncludePath = mt5.includePath ?? terminal.mt5IncludePath;
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
  const terminals = applyLiveStateToTerminals(state.terminals);
  return {
    cacsmsEaRoot: system?.root ?? resolveCacsmsEaRoot(),
    systemFolder: system ?? {
      root: resolveCacsmsEaRoot(),
      expertsPath: resolveCacsmsEaRoot(),
      includePath: null,
      exists: false,
      files: [],
      fileCount: 0,
      lastScannedAt: state.lastUpdatedAt,
      lastModifiedAt: null
    },
    totalTerminals: terminals.length,
    connectedTerminals: terminals.filter((t) => t.connectionStatus === "Connected").length,
    linkedTerminals: terminals.filter((t) => t.linkStatus === "Linked").length,
    driftedTerminals: terminals.filter((t) => t.linkStatus === "Drifted").length,
    managedTerminals: terminals.filter((t) => t.operatorManaged).length,
    activeTerminalId: state.activeTerminalId,
    linkHealthScore: linkHealthScore(terminals),
    lastUpdatedAt: state.lastUpdatedAt
  };
}

function activeTerminal() {
  if (!state.activeTerminalId) return null;
  const terminal = state.terminals.find((item) => item.terminalId === state.activeTerminalId);
  return terminal ? mergeTerminalLiveState({ ...terminal }) : null;
}

export async function buildEaTerminalHubResponse(role: Mt5Role): Promise<EaTerminalHubResponse> {
  hydrateTerminalProfiles();
  await refreshSystemFolder();
  for (const terminal of state.terminals) {
    await refreshTerminalLink(terminal);
  }
  await refreshAllDrift();
  state.lastUpdatedAt = new Date().toISOString();
  const terminals = applyLiveStateToTerminals(state.terminals);
  const focused = activeTerminal();
  return {
    meta: {
      timestamp: state.lastUpdatedAt,
      currentRole: role,
      streamEndpoint: "/api/mt5/ea-terminal-hub/events-stream"
    },
    summary: buildSummary(),
    terminals,
    drift: state.drift,
    workflow: buildWorkflow(terminals),
    installChecklist: buildInstallChecklist(focused, state.systemFolder?.fileCount ?? 0),
    audits: state.audits.slice(0, 25),
    permissions: buildPermissions(role)
  };
}

export function summary(role: Mt5Role) {
  return buildSummary();
}

export async function scanFolders(role: Mt5Role, request?: Request) {
  authorize(role, "scan");
  hydrateTerminalProfiles();
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
    const oldStatus = terminal.operatorManaged;
    terminal.operatorManaged = true;
    terminal.lastConnectedAt = new Date().toISOString();

    try {
      if (terminal.terminalExecutablePath && !terminal.terminalExecutablePath.includes("Pending")) {
        await validateTerminalExecutable(terminal.terminalExecutablePath);
      }
    } catch {
      terminal.notes = "Terminal executable path could not be validated on this host. Bridge connectivity will still be tracked remotely.";
    }

    if (payload.autoLink ?? terminal.autoLinkOnConnect) {
      await linkTerminalFolder({ terminalId, confirmed: true }, role, request, terminal);
    }

    mergeTerminalLiveState(terminal);
    audit(role, "Terminal connected for hub management", terminalId, oldStatus, terminal.operatorManaged, request);
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
  return {
    ok: true,
    message: `${updated.length} terminal(s) placed under hub management. Live bridge connectivity is derived from EA heartbeats.`,
    terminals: applyLiveStateToTerminals(updated),
    summary: buildSummary()
  } satisfies ActionResponse;
}

export function disconnectTerminals(terminalIds: string[], role: Mt5Role, confirmed: boolean, request?: Request) {
  authorize(role, "disconnect");
  confirm(confirmed);
  const updated: Mt5TerminalLink[] = [];
  for (const terminalId of terminalIds) {
    const terminal = terminalById(terminalId);
    const oldStatus = terminal.operatorManaged;
    terminal.operatorManaged = false;
    if (state.activeTerminalId === terminalId) {
      const fallback = state.terminals.find((t) => t.operatorManaged && t.terminalId !== terminalId);
      state.activeTerminalId = fallback?.terminalId ?? null;
      state.terminals.forEach((t) => {
        t.isActive = t.terminalId === state.activeTerminalId;
      });
    }
    audit(role, "Terminal removed from hub management", terminalId, oldStatus, terminal.operatorManaged, request);
    updated.push(terminal);
  }
  state.lastUpdatedAt = new Date().toISOString();
  return {
    ok: true,
    message: `${updated.length} terminal(s) removed from active hub management.`,
    terminals: applyLiveStateToTerminals(updated),
    summary: buildSummary()
  } satisfies ActionResponse;
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
  terminal.mt5ExpertsPath = deriveMt5ExpertsPath(terminal.terminalExecutablePath);
  terminal.mt5DataRoot = deriveMt5DataRoot(terminal.terminalExecutablePath);
  terminal.mt5IncludePath = deriveMt5IncludePath(terminal.terminalExecutablePath);

  const relativePaths = payload.relativePaths?.length
    ? payload.relativePaths
    : payload.fileNames?.length
      ? payload.fileNames
      : system.files.map((file) => file.relativePath);

  const copied = relativePaths.length ? await copyLinkedEaFiles(terminal.mt5ExpertsPath, relativePaths) : await copyAllLinkedEaArtifacts(terminal.mt5ExpertsPath, system.files);
  terminal.linkedAt = new Date().toISOString();
  await refreshTerminalLink(terminal);
  if (state.activeTerminalId === terminal.terminalId) {
    await refreshAllDrift(terminal.terminalId);
  }
  audit(role, "EA folder linked", terminal.terminalId, null, { copied, path: terminal.mt5ExpertsPath }, request);
  state.lastUpdatedAt = new Date().toISOString();
  return {
    ok: true,
    message: `Linked ${copied.length} EA artifact(s) to ${terminal.terminalName}.`,
    terminal: mergeTerminalLiveState(terminal),
    copiedFiles: copied,
    summary: buildSummary()
  } satisfies ActionResponse;
}

export async function previewTerminalSync(terminalId: string, role: Mt5Role) {
  authorize(role, "previewSync");
  const terminal = terminalById(terminalId);
  const system = state.systemFolder ?? (await refreshSystemFolder());
  const preview = await previewLinkedEaSync(terminal.mt5ExpertsPath, system.files);
  return { ok: true, message: `Preview generated for ${terminal.terminalName}.`, preview, summary: buildSummary() } satisfies ActionResponse;
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
  return {
    ok: true,
    message: "Active terminal updated.",
    terminal: mergeTerminalLiveState(terminalById(terminalId)),
    summary: buildSummary()
  } satisfies ActionResponse;
}

export async function syncAllTerminalFolders(role: Mt5Role, confirmed: boolean, request?: Request) {
  authorize(role, "syncAll");
  confirm(confirmed);
  const connected = state.terminals.filter((t) => t.operatorManaged);
  for (const terminal of connected) {
    await linkTerminalFolder({ terminalId: terminal.terminalId, confirmed: true }, role, request, terminal);
  }
  state.lastUpdatedAt = new Date().toISOString();
  audit(role, "All managed terminals synced", "all", null, { count: connected.length }, request);
  return {
    ok: true,
    message: `Synchronized ${connected.length} managed terminal EA folder(s).`,
    summary: buildSummary()
  } satisfies ActionResponse;
}

export function registerTerminal(
  payload: {
    terminalName: string;
    terminalExecutablePath: string;
    brokerName: string;
    accountLogin: string;
    hostMachine: string;
    region: string;
  },
  role: Mt5Role,
  request?: Request
) {
  authorize(role, "register");
  validateTerminalRegistration(payload);
  if (state.terminals.some((terminal) => terminal.terminalName === payload.terminalName.trim())) {
    throw new Error("A terminal profile with this name already exists.");
  }

  const terminalId = `term-custom-${Date.now()}`;
  const terminal = createTerminalLinkFromMonitor(
    terminalId,
    `custom-${terminalId}`,
    payload.terminalName.trim(),
    payload.brokerName.trim(),
    payload.accountLogin.trim(),
    payload.hostMachine.trim(),
    payload.region.trim(),
    payload.terminalExecutablePath.trim()
  );
  terminal.notes = "Custom terminal profile registered from EA & Terminal Hub.";
  state.terminals.unshift(terminal);
  audit(role, "Terminal profile registered", terminalId, null, terminal, request);
  state.lastUpdatedAt = new Date().toISOString();
  return {
    ok: true,
    message: "Terminal profile registered.",
    terminal: mergeTerminalLiveState(terminal),
    summary: buildSummary()
  } satisfies ActionResponse;
}

export function provisionEaTerminalHubFromOnboarding(input: { terminal: Terminal; terminalPath?: string; eaInstanceId?: string }, role: Mt5Role, request?: Request) {
  authorize(role, "register");
  if (state.terminals.some((terminal) => terminal.terminalId === input.terminal.id)) {
    return terminalById(input.terminal.id);
  }
  const terminal = createTerminalLinkFromMonitor(
    input.terminal.id,
    input.terminal.terminalUuid,
    input.terminal.terminalName,
    input.terminal.brokerName,
    input.terminal.accountLogin,
    input.terminal.hostMachine,
    input.terminal.region ?? "Unassigned",
    input.terminalPath ?? "Pending terminal installation"
  );
  terminal.eaInstanceId = input.eaInstanceId ?? null;
  terminal.bridgeChannelId = input.eaInstanceId ?? null;
  terminal.notes = "Provisioned from MT5 terminal onboarding.";
  state.terminals.unshift(terminal);
  audit(role, "Terminal profile provisioned from onboarding", terminal.terminalId, null, terminal, request);
  state.lastUpdatedAt = new Date().toISOString();
  return terminal;
}

export function toggleAutoLink(terminalId: string, enabled: boolean, role: Mt5Role, request?: Request) {
  authorize(role, "connect");
  const terminal = terminalById(terminalId);
  const previous = terminal.autoLinkOnConnect;
  terminal.autoLinkOnConnect = enabled;
  audit(role, "Auto-link preference updated", terminalId, previous, enabled, request);
  state.lastUpdatedAt = new Date().toISOString();
  return {
    ok: true,
    message: `Auto-link on connect ${enabled ? "enabled" : "disabled"} for ${terminal.terminalName}.`,
    terminal: mergeTerminalLiveState(terminal),
    summary: buildSummary()
  } satisfies ActionResponse;
}

import type {
  ActionResponse,
  ConnectTerminalsRequest,
  EaTerminalHubResponse,
  LinkFolderRequest
} from "../types/ea-terminal-hub.types";
import { useEaTerminalHubStore } from "../stores/ea-terminal-hub.store";

const BASE = "/api/mt5/ea-terminal-hub";

function roleHeaders(extra?: HeadersInit): HeadersInit {
  return { "Content-Type": "application/json", "x-mt5-role": useEaTerminalHubStore.getState().role, ...(extra ?? {}) };
}

export async function fetchEaTerminalHub(): Promise<EaTerminalHubResponse> {
  const response = await fetch(BASE, { headers: roleHeaders(), cache: "no-store" });
  if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error ?? "Failed to load EA terminal hub.");
  return response.json() as Promise<EaTerminalHubResponse>;
}

export async function runEaTerminalHubAction(path: string, body?: Record<string, unknown>): Promise<ActionResponse> {
  const response = await fetch(`${BASE}/${path}`, {
    method: "POST",
    headers: roleHeaders(),
    body: JSON.stringify({ confirmed: true, ...body })
  });
  const payload = (await response.json().catch(() => ({}))) as ActionResponse & { error?: string };
  if (!response.ok) throw new Error(payload.error ?? `EA terminal hub action failed (${path}).`);
  return payload;
}

export function connectTerminals(payload: ConnectTerminalsRequest) {
  return runEaTerminalHubAction("connect", { ...payload, confirmed: true });
}

export function disconnectTerminals(terminalIds: string[]) {
  return runEaTerminalHubAction("disconnect", { terminalIds, confirmed: true });
}

export function linkTerminalFolder(payload: LinkFolderRequest) {
  return runEaTerminalHubAction("link", { ...payload, confirmed: true });
}

export function scanEaFolders() {
  return runEaTerminalHubAction("scan", {});
}

export function setActiveTerminal(terminalId: string) {
  return runEaTerminalHubAction("set-active", { terminalId });
}

export function syncAllEaFolders() {
  return runEaTerminalHubAction("sync-all", { confirmed: true });
}

export function registerTerminalProfile(body: Record<string, string>) {
  return runEaTerminalHubAction("register-terminal", body);
}

export function previewTerminalSync(terminalId: string) {
  return runEaTerminalHubAction("preview-sync", { terminalId });
}

export function toggleAutoLink(terminalId: string, enabled: boolean) {
  return runEaTerminalHubAction("toggle-auto-link", { terminalId, enabled });
}

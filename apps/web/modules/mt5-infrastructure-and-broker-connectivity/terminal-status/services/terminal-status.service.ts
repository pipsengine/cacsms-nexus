import type { TerminalStatusResponse } from "../types/terminal-status.types";

export async function fetchTerminalStatus() {
  const response = await fetch("/api/mt5/terminal-status", { cache: "no-store" });
  if (!response.ok) throw new Error("Unable to load MT5 terminal status.");
  return (await response.json()) as TerminalStatusResponse;
}

export async function runTerminalAction(path: string, body: Record<string, unknown> = { confirmed: true }) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  const payload = (await response.json()) as { error?: string };
  if (!response.ok) throw new Error(payload.error ?? "Terminal action failed.");
  return payload;
}

import type { EaBridgeResponse } from "../types/ea-bridge.types";

export async function fetchEaBridge() {
  const response = await fetch("/api/mt5/ea-bridge", { cache: "no-store" });
  if (!response.ok) throw new Error("Unable to load EA Bridge status.");
  return (await response.json()) as EaBridgeResponse;
}

export async function runEaBridgeAction(path: string, body: Record<string, unknown> = { confirmed: true }) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  const payload = (await response.json()) as { error?: string };
  if (!response.ok) throw new Error(payload.error ?? "EA Bridge operation failed.");
  return payload;
}

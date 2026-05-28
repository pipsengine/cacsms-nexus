import type { RemoteControlHubResponse } from "../types/remote-control-hub.types";

const base = "/api/autonomous-computer-operator/remote-control-hub";

export async function fetchRemoteControlHub(host?: string | null): Promise<RemoteControlHubResponse> {
  const query = host ? `?host=${encodeURIComponent(host)}` : "";
  const response = await fetch(`${base}${query}`, { cache: "no-store" });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error ?? "Remote control hub telemetry could not be loaded.");
  }
  return response.json() as Promise<RemoteControlHubResponse>;
}

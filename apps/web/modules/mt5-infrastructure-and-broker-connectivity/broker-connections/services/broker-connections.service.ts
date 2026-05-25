import type { BrokerConnectionsResponse } from "../types/broker-connections.types";

export async function fetchBrokerConnections() {
  const response = await fetch("/api/mt5/broker-connections", { cache: "no-store" });
  if (!response.ok) throw new Error("Unable to load broker connection status.");
  return (await response.json()) as BrokerConnectionsResponse;
}

export async function runBrokerAction(path: string, body: Record<string, unknown> = { confirmed: true }) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  const payload = (await response.json()) as { error?: string };
  if (!response.ok) throw new Error(payload.error ?? "Broker connection operation failed.");
  return payload;
}

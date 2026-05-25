import type { MarketWatchResponse } from "../types/market-watch.types";

export async function fetchMarketWatch() {
  const response = await fetch("/api/mt5/market-watch", { cache: "no-store" });
  if (!response.ok) throw new Error("Unable to load market-watch quotes.");
  return (await response.json()) as MarketWatchResponse;
}

export async function runMarketWatchAction(path: string, body: Record<string, unknown> = { confirmed: true }) {
  const response = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const payload = (await response.json()) as { error?: string };
  if (!response.ok) throw new Error(payload.error ?? "Market-watch operation failed.");
  return payload;
}

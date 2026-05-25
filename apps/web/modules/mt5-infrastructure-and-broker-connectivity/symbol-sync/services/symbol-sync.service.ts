import type { SymbolSyncResponse } from "../types/symbol-sync.types";

export async function fetchSymbolSync() {
  const response = await fetch("/api/mt5/symbol-sync", { cache: "no-store" });
  if (!response.ok) throw new Error("Unable to load symbol synchronization state.");
  return (await response.json()) as SymbolSyncResponse;
}

export async function runSymbolSyncAction(path: string, body: Record<string, unknown> = { confirmed: true }, method: "POST" | "PATCH" = "POST") {
  const response = await fetch(path, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const payload = (await response.json()) as { error?: string };
  if (!response.ok) throw new Error(payload.error ?? "Symbol synchronization operation failed.");
  return payload;
}

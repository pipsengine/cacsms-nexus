import type { AccountSyncResponse } from "../types/account-sync.types";

export async function fetchAccountSync() {
  const response = await fetch("/api/mt5/account-sync", { cache: "no-store" });
  if (!response.ok) throw new Error("Unable to load account synchronization state.");
  return (await response.json()) as AccountSyncResponse;
}
export async function runAccountSyncAction(path: string, body: Record<string, unknown> = { confirmed: true }) {
  const response = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const payload = (await response.json()) as { error?: string };
  if (!response.ok) throw new Error(payload.error ?? "Account synchronization operation failed.");
  return payload;
}

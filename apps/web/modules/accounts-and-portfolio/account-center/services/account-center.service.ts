import type { AccountCenterResponse } from "../types/account-center.types";

const base = "/api/accounts-and-portfolio/account-center";

export async function fetchAccountCenter(): Promise<AccountCenterResponse> {
  const response = await fetch(base, { cache: "no-store" });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error ?? "Account center telemetry could not be loaded.");
  }
  return response.json() as Promise<AccountCenterResponse>;
}

export async function runAccountCenterAction(path: string, body?: Record<string, unknown>, method: "POST" | "PATCH" = "POST") {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body ?? {})
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error ?? "Account center action failed.");
  }
  return response.json();
}

export async function exportAccountCenterInventory(payload: { format?: "json" | "csv"; category?: string; search?: string }) {
  return runAccountCenterAction("/export", payload) as Promise<{
    ok: boolean;
    message: string;
    format: "json" | "csv";
    filename: string;
    total: number;
  }>;
}

import type { Mt5ControlCenterResponse } from "../types/mt5-control-center.types";

export async function fetchMt5ControlCenter() {
  const response = await fetch("/api/mt5", { cache: "no-store" });
  if (!response.ok) throw new Error("Unable to load MT5 infrastructure status.");
  return (await response.json()) as Mt5ControlCenterResponse;
}

export async function runMt5Action(path: string, method: "POST" | "PATCH" = "POST", body?: unknown) {
  const response = await fetch(path, {
    method,
    headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined
  });
  const payload = (await response.json()) as { error?: string };
  if (!response.ok) throw new Error(payload.error ?? "MT5 control action failed.");
  return payload;
}

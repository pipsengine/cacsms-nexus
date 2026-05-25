import type { RouterResponse } from "../types/order-router.types";

export async function fetchOrderRouter() {
  const response = await fetch("/api/mt5/order-router", { cache: "no-store" });
  if (!response.ok) throw new Error("Unable to load order routing state.");
  return (await response.json()) as RouterResponse;
}
export async function runRouterAction(path: string, body: Record<string, unknown> = { confirmed: true }) {
  const response = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const payload = (await response.json()) as { error?: string };
  if (!response.ok) throw new Error(payload.error ?? "Order router operation failed.");
  return payload;
}

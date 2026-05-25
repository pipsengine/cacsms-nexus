import type { ChartControlResponse, Timeframe } from "../types/chart-control.types";

export async function fetchChartControl() {
  const response = await fetch("/api/mt5/chart-control", { cache: "no-store" });
  if (!response.ok) throw new Error("Unable to load chart-control workspace.");
  return (await response.json()) as ChartControlResponse;
}

export async function runChartAction(path: string, body: Record<string, unknown> = { confirmed: true }) {
  const response = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const payload = (await response.json()) as { error?: string };
  if (!response.ok) throw new Error(payload.error ?? "Chart-control operation failed.");
  return payload;
}

export function timeframePayload(timeframe: Timeframe) {
  return { confirmed: true, timeframe };
}

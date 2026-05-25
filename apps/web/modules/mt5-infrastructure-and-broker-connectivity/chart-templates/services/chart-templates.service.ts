import type { TemplateResponse } from "../types/chart-templates.types";

export async function fetchChartTemplates() {
  const response = await fetch("/api/mt5/chart-templates", { cache: "no-store" });
  if (!response.ok) throw new Error("Unable to load chart-template registry.");
  return (await response.json()) as TemplateResponse;
}

export async function runTemplateAction(path: string, body: Record<string, unknown> = { confirmed: true }) {
  const response = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const payload = (await response.json()) as { error?: string };
  if (!response.ok) throw new Error(payload.error ?? "Chart-template operation failed.");
  return payload;
}

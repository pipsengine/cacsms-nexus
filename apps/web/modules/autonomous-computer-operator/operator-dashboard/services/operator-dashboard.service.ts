import type { OperatorDashboardResponse } from "../types/operator-dashboard.types";

const base = "/api/autonomous-computer-operator/operator-dashboard";

export async function fetchOperatorDashboard(host?: string | null): Promise<OperatorDashboardResponse> {
  const query = host ? `?host=${encodeURIComponent(host)}` : "";
  const response = await fetch(`${base}${query}`, { cache: "no-store" });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error ?? "Operator dashboard telemetry could not be loaded.");
  }
  return response.json() as Promise<OperatorDashboardResponse>;
}

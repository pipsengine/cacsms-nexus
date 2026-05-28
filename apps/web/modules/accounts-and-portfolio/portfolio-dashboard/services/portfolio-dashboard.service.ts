import type { PortfolioDashboardResponse } from "../types/portfolio-dashboard.types";

const base = "/api/accounts-and-portfolio/portfolio-dashboard";

export async function fetchPortfolioDashboard(accountId?: string | null): Promise<PortfolioDashboardResponse> {
  const query = accountId ? `?accountId=${encodeURIComponent(accountId)}` : "";
  const response = await fetch(`${base}${query}`, { cache: "no-store" });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error ?? "Portfolio dashboard telemetry could not be loaded.");
  }
  return response.json() as Promise<PortfolioDashboardResponse>;
}

import type { RiskAndExposureResponse } from "../types/risk-and-exposure.types";

const base = "/api/accounts-and-portfolio/risk-and-exposure";

export async function fetchRiskAndExposure(accountId?: string | null): Promise<RiskAndExposureResponse> {
  const query = accountId ? `?accountId=${encodeURIComponent(accountId)}` : "";
  const response = await fetch(`${base}${query}`, { cache: "no-store" });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error ?? "Risk and exposure telemetry could not be loaded.");
  }
  return response.json() as Promise<RiskAndExposureResponse>;
}

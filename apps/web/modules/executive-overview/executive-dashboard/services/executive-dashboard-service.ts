import type { ExecutiveDashboardResponse } from "../types/executive-dashboard.types";

const DEFAULT_ENDPOINT = "/api/executive-overview/executive-dashboard";

export async function fetchExecutiveDashboard(options?: { endpoint?: string }) {
  const endpoint = options?.endpoint ?? DEFAULT_ENDPOINT;

  const response = await fetch(endpoint, {
    method: "GET",
    headers: {
      "content-type": "application/json"
    },
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Executive dashboard request failed (${response.status})`);
  }

  return (await response.json()) as ExecutiveDashboardResponse;
}

export function mockAuditLog(event: {
  action: string;
  at: string;
  actor: string;
  context?: Record<string, unknown>;
}) {
  console.log("[audit]", event);
}

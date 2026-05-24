import type { ExecutiveDashboardResponse } from "../types/executive-dashboard.types";
import { getExecutiveDashboardMock } from "../data/executive-dashboard.mock";

const DEFAULT_ENDPOINT = "/api/executive-overview/executive-dashboard";

function shouldUseMockOnly() {
  return typeof window !== "undefined" && window.location.search.includes("mock=1");
}

export async function fetchExecutiveDashboard(options?: { endpoint?: string; allowMockFallback?: boolean }) {
  const endpoint = options?.endpoint ?? DEFAULT_ENDPOINT;
  const allowMockFallback = options?.allowMockFallback ?? true;

  if (shouldUseMockOnly()) {
    return getExecutiveDashboardMock();
  }

  try {
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

    const payload = (await response.json()) as ExecutiveDashboardResponse;
    return payload;
  } catch (error) {
    if (!allowMockFallback) {
      throw error;
    }
    return getExecutiveDashboardMock();
  }
}

export function mockAuditLog(event: {
  action: string;
  at: string;
  actor: string;
  context?: Record<string, unknown>;
}) {
  console.log("[audit]", event);
}


import type { DesktopAutomationHubResponse, TopDownAnalysisInput, TopDownAnalysisRun } from "../types/desktop-automation-hub.types";

const base = "/api/autonomous-computer-operator/desktop-automation-hub";

export async function fetchDesktopAutomationHub(terminalId?: string | null): Promise<DesktopAutomationHubResponse> {
  const query = terminalId ? `?terminalId=${encodeURIComponent(terminalId)}` : "";
  const response = await fetch(`${base}${query}`, { cache: "no-store" });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error ?? "Desktop automation hub telemetry could not be loaded.");
  }
  return response.json() as Promise<DesktopAutomationHubResponse>;
}

async function postAction<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${base}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error ?? "Desktop automation action failed.");
  }
  return response.json() as Promise<T>;
}

export function startTopDownAnalysis(input: TopDownAnalysisInput) {
  return postAction<TopDownAnalysisRun>("top-down/start", { ...input, confirmed: true, autonomous: true });
}

export function cancelAutomationRun(runId: string) {
  return postAction<TopDownAnalysisRun>(`runs/${encodeURIComponent(runId)}/cancel`, { confirmed: true });
}

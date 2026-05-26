import type {
  ActionResponse,
  BottlenecksResponse,
  DiagnosticsResponse,
  ExceptionsResponse,
  ExecutionQueueItemResponse,
  ExecutionQueueItemsResponse,
  ExecutionQueueSummaryResponse,
  FeedbackResponse,
  LogsResponse,
  PrioritySlaResponse
} from "../types/execution-queue.types";
import { useExecutionQueueStore } from "../stores/execution-queue.store";

const BASE = "/api/mt5/execution-queue";

function roleHeaders(extra?: HeadersInit): HeadersInit {
  const role = useExecutionQueueStore.getState().role;
  return { "x-mt5-role": role, ...(extra ?? {}) };
}

export async function fetchExecutionQueueSummary() {
  const res = await fetch(`${BASE}/summary`, { cache: "no-store", headers: roleHeaders() });
  if (!res.ok) throw new Error(`summary ${res.status}`);
  return (await res.json()) as ExecutionQueueSummaryResponse;
}

export async function fetchExecutionQueueItems(params?: { search?: string; status?: string; priority?: string; page?: number; pageSize?: number }) {
  const url = new URL(`${BASE}/items`, typeof window !== "undefined" ? window.location.origin : "http://localhost");
  if (params?.search) url.searchParams.set("search", params.search);
  if (params?.status) url.searchParams.set("status", params.status);
  if (params?.priority) url.searchParams.set("priority", params.priority);
  if (params?.page) url.searchParams.set("page", String(params.page));
  if (params?.pageSize) url.searchParams.set("pageSize", String(params.pageSize));
  const res = await fetch(url.toString(), { cache: "no-store", headers: roleHeaders() });
  if (!res.ok) throw new Error(`items ${res.status}`);
  return (await res.json()) as ExecutionQueueItemsResponse;
}

export async function fetchExecutionQueueItem(queueId: string) {
  const res = await fetch(`${BASE}/items/${queueId}`, { cache: "no-store", headers: roleHeaders() });
  if (!res.ok) throw new Error(`item ${res.status}`);
  return (await res.json()) as ExecutionQueueItemResponse;
}

export async function fetchPrioritySla() {
  const res = await fetch(`${BASE}/priority-sla`, { cache: "no-store", headers: roleHeaders() });
  if (!res.ok) throw new Error(`priority-sla ${res.status}`);
  return (await res.json()) as PrioritySlaResponse;
}

export async function fetchBottlenecks() {
  const res = await fetch(`${BASE}/bottlenecks`, { cache: "no-store", headers: roleHeaders() });
  if (!res.ok) throw new Error(`bottlenecks ${res.status}`);
  return (await res.json()) as BottlenecksResponse;
}

export async function fetchExceptions() {
  const res = await fetch(`${BASE}/exceptions`, { cache: "no-store", headers: roleHeaders() });
  if (!res.ok) throw new Error(`exceptions ${res.status}`);
  return (await res.json()) as ExceptionsResponse;
}

export async function fetchExecutionFeedback() {
  const res = await fetch(`${BASE}/execution-feedback`, { cache: "no-store", headers: roleHeaders() });
  if (!res.ok) throw new Error(`execution-feedback ${res.status}`);
  return (await res.json()) as FeedbackResponse;
}

export async function fetchExecutionQueueLogs() {
  const res = await fetch(`${BASE}/logs`, { cache: "no-store", headers: roleHeaders() });
  if (!res.ok) throw new Error(`logs ${res.status}`);
  return (await res.json()) as LogsResponse;
}

export async function fetchExecutionQueueDiagnostics() {
  const res = await fetch(`${BASE}/ai-diagnostics`, { cache: "no-store", headers: roleHeaders() });
  if (!res.ok) throw new Error(`ai-diagnostics ${res.status}`);
  return (await res.json()) as DiagnosticsResponse;
}

export async function postProcessQueue() {
  const res = await fetch(`${BASE}/process`, { method: "POST", headers: roleHeaders() });
  if (!res.ok) throw new Error(`process ${res.status}`);
  return (await res.json()) as ActionResponse;
}

export async function postPauseQueue() {
  const res = await fetch(`${BASE}/pause`, { method: "POST", headers: roleHeaders() });
  if (!res.ok) throw new Error(`pause ${res.status}`);
  return (await res.json()) as ActionResponse;
}

export async function postResumeQueue() {
  const res = await fetch(`${BASE}/resume`, { method: "POST", headers: roleHeaders() });
  if (!res.ok) throw new Error(`resume ${res.status}`);
  return (await res.json()) as ActionResponse;
}

export async function postEmergencyStopQueue() {
  const res = await fetch(`${BASE}/emergency-stop`, { method: "POST", headers: roleHeaders() });
  if (!res.ok) throw new Error(`emergency-stop ${res.status}`);
  return (await res.json()) as ActionResponse;
}

export async function postValidateQueueItem(queueId: string) {
  const res = await fetch(`${BASE}/items/${queueId}/validate`, { method: "POST", headers: roleHeaders() });
  if (!res.ok) throw new Error(`validate ${res.status}`);
  return (await res.json()) as ActionResponse;
}

export async function postRetryQueueItem(queueId: string) {
  const res = await fetch(`${BASE}/items/${queueId}/retry`, { method: "POST", headers: roleHeaders() });
  if (!res.ok) throw new Error(`retry ${res.status}`);
  return (await res.json()) as ActionResponse;
}

export async function postCancelQueueItem(queueId: string) {
  const res = await fetch(`${BASE}/items/${queueId}/cancel`, { method: "POST", headers: roleHeaders() });
  if (!res.ok) throw new Error(`cancel ${res.status}`);
  return (await res.json()) as ActionResponse;
}

export async function postReassignRoute(queueId: string) {
  const res = await fetch(`${BASE}/items/${queueId}/reassign-route`, { method: "POST", headers: roleHeaders() });
  if (!res.ok) throw new Error(`reassign-route ${res.status}`);
  return (await res.json()) as ActionResponse;
}

export async function postAutoRemediate() {
  const res = await fetch(`${BASE}/auto-remediate`, { method: "POST", headers: roleHeaders() });
  if (!res.ok) throw new Error(`auto-remediate ${res.status}`);
  return (await res.json()) as ActionResponse;
}

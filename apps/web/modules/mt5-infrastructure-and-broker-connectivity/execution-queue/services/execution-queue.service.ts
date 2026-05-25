import type { Mt5Role } from "../../mt5-control-center/types/mt5-control-center.types";
import {
  calculateQueueHealthScore,
  computePrioritySlaSummary,
  deriveSlaStatus,
  detectBottlenecks,
  generateQueueDiagnostics,
  prioritizeQueue,
  safeRetryDecision
} from "../algorithms/execution-queue.algorithms";
import { createExecutionQueueSeed } from "../data/execution-queue.mock";
import type {
  ActionResponse,
  BottlenecksResponse,
  DiagnosticsResponse,
  ExceptionsResponse,
  ExecutionFeedback,
  ExecutionQueueItem,
  ExecutionQueueItemResponse,
  ExecutionQueueItemsResponse,
  ExecutionQueueSummaryResponse,
  FeedbackResponse,
  LogsResponse,
  PrioritySlaResponse,
  QueueBottleneck,
  QueueException,
  QueueLog
} from "../types/execution-queue.types";
import { useExecutionQueueStore } from "../stores/execution-queue.store";

const BASE = "/api/mt5/execution-queue";

function nowIso() {
  return new Date().toISOString();
}

function mockOnly() {
  return typeof window !== "undefined" && window.location.search.includes("mock=1");
}

function roleHeaders(extra?: HeadersInit): HeadersInit {
  const role = useExecutionQueueStore.getState().role;
  return { "x-mt5-role": role, ...(extra ?? {}) };
}

type MockState = {
  queuePaused: boolean;
  emergencyStopActive: boolean;
  items: ExecutionQueueItem[];
  logs: QueueLog[];
  feedback: ExecutionFeedback[];
  bottlenecks: QueueBottleneck[];
};

let mockState: MockState | null = null;

function ensureMockState(): MockState {
  if (mockState) return mockState;
  const seed = createExecutionQueueSeed();
  mockState = { queuePaused: false, emergencyStopActive: false, items: seed.items, logs: seed.logs, feedback: seed.feedback, bottlenecks: seed.bottlenecks };
  return mockState;
}

function refreshDerived(state: MockState) {
  const now = Date.now();
  state.items = state.items.map((it) => {
    const age = Math.max(0, Math.round((now - new Date(it.createdAt).getTime()) / 1000));
    const next = { ...it, queueAgeSeconds: age } satisfies ExecutionQueueItem;
    return { ...next, slaStatus: deriveSlaStatus(next) };
  });
}

function permissions(role: Mt5Role) {
  return {
    role,
    canProcess: role === "Super Admin" || role === "Trading Admin",
    canPauseResume: role === "Super Admin" || role === "Trading Admin",
    canRetry: role === "Super Admin" || role === "Trading Admin",
    canCancel: role === "Super Admin" || role === "Trading Admin",
    canValidate: role === "Super Admin" || role === "Trading Admin",
    canReassignRoute: role === "Super Admin" || role === "Infrastructure Admin",
    canEmergencyStop: role === "Super Admin",
    canDiagnostics: role === "Super Admin" || role === "Infrastructure Admin",
    canAutoRemediate: role === "Super Admin" || role === "Infrastructure Admin"
  };
}

function makeKpis(items: ExecutionQueueItem[], healthScore: number) {
  const count = (p: (i: ExecutionQueueItem) => boolean) => items.filter(p).length;
  const total = items.length;
  const avgWait = Math.round(items.reduce((sum, it) => sum + it.queueAgeSeconds, 0) / Math.max(1, total));
  const status = (value: number, warn: number, critical: number) => (value >= critical ? "Critical" : value >= warn ? "Degraded" : "Healthy");
  return [
    { label: "Total Queue Items", value: String(total), status: "Healthy", detail: "All execution requests in queue", updatedAt: nowIso() },
    { label: "Pending Execution", value: String(count((i) => i.queueStatus === "Pending")), status: status(count((i) => i.queueStatus === "Pending"), 10, 20), detail: "Awaiting validation", updatedAt: nowIso() },
    { label: "Validated Items", value: String(count((i) => i.queueStatus === "Validated")), status: "Healthy", detail: "Passed pre-execution validation", updatedAt: nowIso() },
    { label: "Processing Items", value: String(count((i) => i.queueStatus === "Processing")), status: "Watch", detail: "In pipeline processing", updatedAt: nowIso() },
    { label: "Routed Items", value: String(count((i) => i.queueStatus === "Routed")), status: "Watch", detail: "Awaiting EA delivery / MT5 feedback", updatedAt: nowIso() },
    { label: "Executed Items", value: String(count((i) => i.queueStatus === "Executed")), status: "Healthy", detail: "MT5 execution confirmed", updatedAt: nowIso() },
    { label: "Failed Items", value: String(count((i) => i.queueStatus === "Failed")), status: status(count((i) => i.queueStatus === "Failed"), 3, 7), detail: "Failed delivery or feedback", updatedAt: nowIso() },
    { label: "Retried Items", value: String(count((i) => i.queueStatus === "Retried")), status: status(count((i) => i.queueStatus === "Retried"), 3, 7), detail: "Retry queued", updatedAt: nowIso() },
    { label: "Cancelled Items", value: String(count((i) => i.queueStatus === "Cancelled")), status: "Healthy", detail: "Cancelled by operator", updatedAt: nowIso() },
    { label: "Blocked Items", value: String(count((i) => i.queueStatus === "Blocked")), status: status(count((i) => i.queueStatus === "Blocked"), 3, 7), detail: "Blocked by gates", updatedAt: nowIso() },
    { label: "Average Queue Wait Time", value: `${avgWait}s`, status: avgWait >= 600 ? "Degraded" : "Healthy", detail: "Average age across queue", updatedAt: nowIso() },
    { label: "Queue Health Score", value: `${healthScore}/100`, status: healthScore >= 75 ? "Healthy" : healthScore >= 60 ? "Degraded" : "Critical", detail: "Throughput + SLA adherence", updatedAt: nowIso() }
  ] as const;
}

function makeWorkflow(items: ExecutionQueueItem[]) {
  const now = nowIso();
  const total = Math.max(1, items.length);
  const avgDelay = Math.round(items.reduce((sum, it) => sum + it.queueAgeSeconds, 0) / total);
  const failed = items.filter((i) => i.queueStatus === "Failed" || i.queueStatus === "Blocked").length;
  const step = (title: string, status: "Operational" | "Degraded" | "Blocked" | "Monitoring", itemCount: number, failedCount: number, aiRecommendation?: string) => ({
    title,
    status,
    itemCount,
    failedCount,
    averageDelaySeconds: avgDelay,
    lastProcessedItem: items[0]?.queueId ?? "—",
    aiRecommendation
  });

  const pending = items.filter((i) => i.queueStatus === "Pending").length;
  const validated = items.filter((i) => i.queueStatus === "Validated").length;
  const processing = items.filter((i) => i.queueStatus === "Processing").length;
  const routed = items.filter((i) => i.queueStatus === "Routed").length;
  const executed = items.filter((i) => i.queueStatus === "Executed").length;

  return [
    step("Trade Decision Approved", "Operational", total, 0, "Verify approvals are signed and auditable."),
    step("Queue Created", "Operational", total, 0, "Ensure queue ingestion is idempotent."),
    step("Pre-Execution Validation", pending > 0 ? "Monitoring" : "Operational", pending, 0, pending > 0 ? "Force-validate high priority items first." : "Validation stable."),
    step("Risk Gate Passed", "Monitoring", validated, 0, "Confirm risk gate outcomes and blackout windows."),
    step("Broker/Account Readiness", "Monitoring", total, 0, "Re-route around offline brokers/terminals."),
    step("Route Assigned", "Monitoring", processing, failed, "Assign healthiest EA route for each broker/account."),
    step("EA Delivery", routed > 0 ? "Monitoring" : "Operational", routed, failed, "Watch EA bridge delivery latency and backlog."),
    step("MT5 Execution", executed > 0 ? "Operational" : "Monitoring", executed, failed, "Verify MT5 response codes and tickets."),
    step("Feedback Received", "Monitoring", executed, 0, "Confirm feedback ingestion closes the queue item."),
    step("Queue Closed", "Operational", executed, 0, "Audit every transition and enforce SLA controls.")
  ].map((w) => ({ ...w, lastProcessedItem: now }));
}

function exceptionRows(items: ExecutionQueueItem[]): QueueException[] {
  const relevant = items.filter((it) => it.queueStatus === "Failed" || it.queueStatus === "Retried" || it.queueStatus === "Blocked" || it.slaStatus === "Expired");
  return relevant.map((it) => {
    const retryEligible =
      safeRetryDecision(it, {
        emergencyStopActive: false,
        queuePaused: false,
        duplicateClear: it.duplicateCheckStatus === "Passed",
        priceWithinTolerance: true,
        dependenciesHealthy:
          it.accountReadinessStatus === "Ready" &&
          it.brokerReadinessStatus === "Ready" &&
          it.terminalReadinessStatus === "Ready" &&
          it.eaBridgeReadinessStatus === "Ready"
      }).safe && it.queueStatus !== "Blocked";

    const reason = it.failureReason ?? (it.queueStatus === "Blocked" ? "Blocked by safety gates" : "Requires review");
    const blockReason = it.queueStatus === "Blocked" ? reason : undefined;
    const requiredAction =
      it.slaStatus === "Expired"
        ? "Cancel expired item and audit."
        : it.queueStatus === "Blocked"
          ? "Review block reason and remediate dependency."
          : it.queueStatus === "Failed"
            ? "Retry only if safe and duplicate risk cleared."
            : "Monitor retry outcome and escalate if repeated failures.";

    return {
      queueId: it.queueId,
      orderId: it.orderId,
      account: it.account,
      broker: it.broker,
      symbol: it.symbol,
      status: it.queueStatus,
      failureReason: reason,
      retryCount: it.retryCount,
      lastRetryAt: it.lastRetryAt,
      retryEligibility: retryEligible ? "Eligible" : "Blocked",
      blockReason,
      aiExplanation: it.queueStatus === "Blocked" ? "Safety gates blocked execution; do not override without risk approval." : "Validate pre-execution checks and retry only when safe.",
      requiredAction
    } satisfies QueueException;
  });
}

function mockSummary(role: Mt5Role): ExecutionQueueSummaryResponse {
  const state = ensureMockState();
  refreshDerived(state);
  const health = calculateQueueHealthScore(state.items);
  const kpis = makeKpis(state.items, health.score);
  return {
    meta: { timestamp: nowIso(), currentRole: role, queuePaused: state.queuePaused, emergencyStopActive: state.emergencyStopActive },
    kpis: [...kpis],
    health,
    workflow: makeWorkflow(state.items),
    permissions: permissions(role)
  };
}

function mockItems(params?: { search?: string; status?: string; priority?: string; page?: number; pageSize?: number }): ExecutionQueueItemsResponse {
  const state = ensureMockState();
  refreshDerived(state);
  const search = params?.search?.trim().toLowerCase() ?? "";
  const status = params?.status ?? "all";
  const priority = params?.priority ?? "all";
  const page = params?.page ?? 1;
  const pageSize = params?.pageSize ?? 50;

  const filtered = prioritizeQueue(state.items).filter((it) => {
    const matchesSearch =
      !search ||
      [it.queueId, it.orderId, it.signalId, it.strategyId, it.account, it.broker, it.terminal, it.eaInstance, it.symbol, it.queueStatus, it.failureReason ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(search);
    const matchesStatus = status === "all" ? true : it.queueStatus === status || it.slaStatus === status || it.executionStatus === status;
    const matchesPriority = priority === "all" ? true : it.priority === priority;
    return matchesSearch && matchesStatus && matchesPriority;
  });

  const start = (page - 1) * pageSize;
  const items = filtered.slice(start, start + pageSize);
  return { meta: { timestamp: nowIso(), total: filtered.length, page, pageSize }, items };
}

function mockItem(queueId: string): ExecutionQueueItemResponse {
  const state = ensureMockState();
  refreshDerived(state);
  const item = state.items.find((it) => it.queueId === queueId);
  if (!item) throw new Error("Queue item not found.");
  return { meta: { timestamp: nowIso() }, item };
}

function mockPrioritySla(): PrioritySlaResponse {
  const state = ensureMockState();
  refreshDerived(state);
  const autoBottlenecks = detectBottlenecks(state.items);
  const summary = computePrioritySlaSummary(state.items, autoBottlenecks);
  return { meta: { timestamp: nowIso() }, summary };
}

function mockBottlenecks(): BottlenecksResponse {
  const state = ensureMockState();
  refreshDerived(state);
  const auto = detectBottlenecks(state.items);
  return { meta: { timestamp: nowIso() }, bottlenecks: [...state.bottlenecks, ...auto].slice(0, 12) };
}

function mockExceptions(): ExceptionsResponse {
  const state = ensureMockState();
  refreshDerived(state);
  const exceptions = exceptionRows(state.items);
  return { meta: { timestamp: nowIso(), total: exceptions.length }, exceptions };
}

function mockFeedback(): FeedbackResponse {
  const state = ensureMockState();
  refreshDerived(state);
  return { meta: { timestamp: nowIso(), total: state.feedback.length }, feedback: state.feedback };
}

function mockLogs(): LogsResponse {
  const state = ensureMockState();
  return { meta: { timestamp: nowIso(), total: state.logs.length }, logs: state.logs };
}

function mockDiagnostics(): DiagnosticsResponse {
  const state = ensureMockState();
  refreshDerived(state);
  const bottlenecks = detectBottlenecks(state.items);
  return { meta: { timestamp: nowIso() }, diagnostics: generateQueueDiagnostics(state.items, bottlenecks) };
}

function mutateMock(action: string, queueIds: string[], mutate: (it: ExecutionQueueItem) => ExecutionQueueItem) {
  const state = ensureMockState();
  refreshDerived(state);
  const affected: string[] = [];
  state.items = state.items.map((it) => {
    if (!queueIds.includes(it.queueId)) return it;
    affected.push(it.queueId);
    return mutate(it);
  });
  state.logs.unshift({
    id: `qlog-${Date.now()}`,
    queueId: queueIds.length === 1 ? queueIds[0] : "ALL",
    orderId: queueIds.length === 1 ? state.items.find((i) => i.queueId === queueIds[0])?.orderId ?? "ALL" : "ALL",
    eventType: action,
    severity: "Info",
    sourceModule: "Execution Queue",
    message: `${action} executed for ${affected.length} queue item(s).`,
    actionTaken: action,
    result: "Ok",
    createdAt: nowIso()
  });
  return affected;
}

function mockActionResponse(ok: boolean, message: string, state: MockState, affected?: string[]): ActionResponse {
  return { meta: { timestamp: nowIso(), queuePaused: state.queuePaused, emergencyStopActive: state.emergencyStopActive }, ok, message, affectedQueueIds: affected };
}

export async function fetchExecutionQueueSummary() {
  if (mockOnly()) return mockSummary(useExecutionQueueStore.getState().role);
  const res = await fetch(`${BASE}/summary`, { cache: "no-store", headers: roleHeaders() });
  if (!res.ok) throw new Error(`summary ${res.status}`);
  return (await res.json()) as ExecutionQueueSummaryResponse;
}

export async function fetchExecutionQueueItems(params?: { search?: string; status?: string; priority?: string; page?: number; pageSize?: number }) {
  if (mockOnly()) return mockItems(params);
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
  if (mockOnly()) return mockItem(queueId);
  const res = await fetch(`${BASE}/items/${queueId}`, { cache: "no-store", headers: roleHeaders() });
  if (!res.ok) throw new Error(`item ${res.status}`);
  return (await res.json()) as ExecutionQueueItemResponse;
}

export async function fetchPrioritySla() {
  if (mockOnly()) return mockPrioritySla();
  const res = await fetch(`${BASE}/priority-sla`, { cache: "no-store", headers: roleHeaders() });
  if (!res.ok) throw new Error(`priority-sla ${res.status}`);
  return (await res.json()) as PrioritySlaResponse;
}

export async function fetchBottlenecks() {
  if (mockOnly()) return mockBottlenecks();
  const res = await fetch(`${BASE}/bottlenecks`, { cache: "no-store", headers: roleHeaders() });
  if (!res.ok) throw new Error(`bottlenecks ${res.status}`);
  return (await res.json()) as BottlenecksResponse;
}

export async function fetchExceptions() {
  if (mockOnly()) return mockExceptions();
  const res = await fetch(`${BASE}/exceptions`, { cache: "no-store", headers: roleHeaders() });
  if (!res.ok) throw new Error(`exceptions ${res.status}`);
  return (await res.json()) as ExceptionsResponse;
}

export async function fetchExecutionFeedback() {
  if (mockOnly()) return mockFeedback();
  const res = await fetch(`${BASE}/execution-feedback`, { cache: "no-store", headers: roleHeaders() });
  if (!res.ok) throw new Error(`execution-feedback ${res.status}`);
  return (await res.json()) as FeedbackResponse;
}

export async function fetchExecutionQueueLogs() {
  if (mockOnly()) return mockLogs();
  const res = await fetch(`${BASE}/logs`, { cache: "no-store", headers: roleHeaders() });
  if (!res.ok) throw new Error(`logs ${res.status}`);
  return (await res.json()) as LogsResponse;
}

export async function fetchExecutionQueueDiagnostics() {
  if (mockOnly()) return mockDiagnostics();
  const res = await fetch(`${BASE}/ai-diagnostics`, { cache: "no-store", headers: roleHeaders() });
  if (!res.ok) throw new Error(`ai-diagnostics ${res.status}`);
  return (await res.json()) as DiagnosticsResponse;
}

export async function postProcessQueue() {
  if (mockOnly()) {
    const state = ensureMockState();
    refreshDerived(state);
    if (state.emergencyStopActive) return mockActionResponse(false, "Emergency stop is active.", state);
    if (state.queuePaused) return mockActionResponse(false, "Queue is paused.", state);
    const targets = prioritizeQueue(state.items).filter((i) => i.queueStatus === "Pending" || i.queueStatus === "Validated" || i.queueStatus === "Processing" || i.queueStatus === "Routed").slice(0, 8);
    const affected = mutateMock("Process Queue", targets.map((t) => t.queueId), (it) => {
      if (it.queueStatus === "Pending") return { ...it, queueStatus: "Validated", validationStatus: "Passed", updatedAt: nowIso(), nextAction: "Process" };
      if (it.queueStatus === "Validated") return { ...it, queueStatus: "Processing", updatedAt: nowIso(), nextAction: "Assign route" };
      if (it.queueStatus === "Processing") return { ...it, queueStatus: "Routed", routingStatus: "Assigned", deliveryStatus: "Pending", updatedAt: nowIso(), nextAction: "Await MT5 feedback" };
      if (it.queueStatus === "Routed") {
        const executedAt = nowIso();
        const ticket = `45${900_000 + Math.floor(Math.random() * 9000)}`;
        state.feedback.unshift({
          id: `fb-${Date.now()}-${it.queueId}`,
          queueId: it.queueId,
          orderId: it.orderId,
          mt5Ticket: ticket,
          deliveredAt: nowIso(),
          executedAt,
          requestedPrice: it.entryPrice,
          executedPrice: it.entryPrice,
          slippagePoints: 0.2,
          executionTimeMs: 180,
          responseCode: "OK",
          responseMessage: "Execution confirmed",
          finalStatus: "Executed",
          createdAt: executedAt
        });
        return { ...it, queueStatus: "Executed", deliveryStatus: "Delivered", executionStatus: "Executed", updatedAt: executedAt, nextAction: "Closed" };
      }
      return it;
    });
    return mockActionResponse(true, `Processed ${affected.length} queue item(s).`, state, affected);
  }

  const res = await fetch(`${BASE}/process`, { method: "POST", headers: roleHeaders() });
  if (!res.ok) throw new Error(`process ${res.status}`);
  return (await res.json()) as ActionResponse;
}

export async function postPauseQueue() {
  if (mockOnly()) {
    const state = ensureMockState();
    state.queuePaused = true;
    state.logs.unshift({ id: `qlog-${Date.now()}`, queueId: "ALL", orderId: "ALL", eventType: "Pause", severity: "Warning", sourceModule: "Execution Queue", message: "Execution queue paused.", actionTaken: "Pause", result: "Paused", createdAt: nowIso() });
    return mockActionResponse(true, "Queue paused.", state);
  }
  const res = await fetch(`${BASE}/pause`, { method: "POST", headers: roleHeaders() });
  if (!res.ok) throw new Error(`pause ${res.status}`);
  return (await res.json()) as ActionResponse;
}

export async function postResumeQueue() {
  if (mockOnly()) {
    const state = ensureMockState();
    if (state.emergencyStopActive) return mockActionResponse(false, "Cannot resume while emergency stop is active.", state);
    state.queuePaused = false;
    state.logs.unshift({ id: `qlog-${Date.now()}`, queueId: "ALL", orderId: "ALL", eventType: "Resume", severity: "Info", sourceModule: "Execution Queue", message: "Execution queue resumed.", actionTaken: "Resume", result: "Running", createdAt: nowIso() });
    return mockActionResponse(true, "Queue resumed.", state);
  }
  const res = await fetch(`${BASE}/resume`, { method: "POST", headers: roleHeaders() });
  if (!res.ok) throw new Error(`resume ${res.status}`);
  return (await res.json()) as ActionResponse;
}

export async function postEmergencyStopQueue() {
  if (mockOnly()) {
    const state = ensureMockState();
    state.emergencyStopActive = true;
    state.queuePaused = true;
    state.logs.unshift({ id: `qlog-${Date.now()}`, queueId: "ALL", orderId: "ALL", eventType: "Emergency Stop", severity: "Critical", sourceModule: "Execution Queue", message: "Emergency stop activated for execution queue.", actionTaken: "Stop", result: "Blocked", createdAt: nowIso() });
    return mockActionResponse(true, "Emergency stop activated.", state);
  }
  const res = await fetch(`${BASE}/emergency-stop`, { method: "POST", headers: roleHeaders() });
  if (!res.ok) throw new Error(`emergency-stop ${res.status}`);
  return (await res.json()) as ActionResponse;
}

export async function postValidateQueueItem(queueId: string) {
  if (mockOnly()) {
    const state = ensureMockState();
    const affected = mutateMock("Force Validate", [queueId], (it) => ({ ...it, validationStatus: "Passed", queueStatus: "Validated", updatedAt: nowIso(), nextAction: "Process" }));
    return mockActionResponse(true, "Queue item validated.", state, affected);
  }
  const res = await fetch(`${BASE}/items/${queueId}/validate`, { method: "POST", headers: roleHeaders() });
  if (!res.ok) throw new Error(`validate ${res.status}`);
  return (await res.json()) as ActionResponse;
}

export async function postRetryQueueItem(queueId: string) {
  if (mockOnly()) {
    const state = ensureMockState();
    refreshDerived(state);
    const item = state.items.find((i) => i.queueId === queueId);
    if (!item) return mockActionResponse(false, "Queue item not found.", state);

    const decision = safeRetryDecision(item, {
      emergencyStopActive: state.emergencyStopActive,
      queuePaused: state.queuePaused,
      duplicateClear: item.duplicateCheckStatus === "Passed",
      priceWithinTolerance: true,
      dependenciesHealthy:
        item.accountReadinessStatus === "Ready" &&
        item.brokerReadinessStatus === "Ready" &&
        item.terminalReadinessStatus === "Ready" &&
        item.eaBridgeReadinessStatus === "Ready"
    });
    if (!decision.safe) return mockActionResponse(false, `Unsafe retry blocked: ${decision.failures.join(", ")}.`, state);

    const affected = mutateMock("Retry Execution", [queueId], (it) => ({
      ...it,
      retryCount: it.retryCount + 1,
      lastRetryAt: nowIso(),
      queueStatus: "Retried",
      executionStatus: "Pending",
      deliveryStatus: "Pending",
      failureReason: undefined,
      updatedAt: nowIso(),
      nextAction: "Await delivery"
    }));
    return mockActionResponse(true, "Retry queued.", state, affected);
  }
  const res = await fetch(`${BASE}/items/${queueId}/retry`, { method: "POST", headers: roleHeaders() });
  if (!res.ok) throw new Error(`retry ${res.status}`);
  return (await res.json()) as ActionResponse;
}

export async function postCancelQueueItem(queueId: string) {
  if (mockOnly()) {
    const state = ensureMockState();
    const affected = mutateMock("Cancel Item", [queueId], (it) => ({ ...it, queueStatus: "Cancelled", deliveryStatus: "Cancelled", executionStatus: "Not Sent", updatedAt: nowIso(), nextAction: "Closed" }));
    return mockActionResponse(true, "Queue item cancelled.", state, affected);
  }
  const res = await fetch(`${BASE}/items/${queueId}/cancel`, { method: "POST", headers: roleHeaders() });
  if (!res.ok) throw new Error(`cancel ${res.status}`);
  return (await res.json()) as ActionResponse;
}

export async function postReassignRoute(queueId: string) {
  if (mockOnly()) {
    const state = ensureMockState();
    const affected = mutateMock("Reassign Route", [queueId], (it) => ({
      ...it,
      routingStatus: "Reassigned",
      assignedRoute: `route-${Math.random() > 0.5 ? "A" : "B"}-${Math.floor(Math.random() * 99)}`,
      updatedAt: nowIso(),
      nextAction: "Retry if safe"
    }));
    return mockActionResponse(true, "Route reassigned.", state, affected);
  }
  const res = await fetch(`${BASE}/items/${queueId}/reassign-route`, { method: "POST", headers: roleHeaders() });
  if (!res.ok) throw new Error(`reassign-route ${res.status}`);
  return (await res.json()) as ActionResponse;
}

export async function postAutoRemediate() {
  if (mockOnly()) {
    const state = ensureMockState();
    refreshDerived(state);
    const bottlenecks = detectBottlenecks(state.items);
    const diags = generateQueueDiagnostics(state.items, bottlenecks);
    const eligible = diags.filter((d) => d.autoFixEligible && d.affectedQueueId).slice(0, 6);
    const affected: string[] = [];
    for (const d of eligible) {
      const id = d.affectedQueueId!;
      const item = state.items.find((i) => i.queueId === id);
      if (!item) continue;
      if (item.slaStatus === "Expired") {
        affected.push(...mutateMock("Auto-Remediate", [id], (it) => ({ ...it, queueStatus: "Cancelled", updatedAt: nowIso(), nextAction: "Closed" })));
        continue;
      }
      affected.push(...mutateMock("Auto-Remediate", [id], (it) => ({ ...it, validationStatus: "Passed", riskStatus: "Passed", queueStatus: "Validated", updatedAt: nowIso(), nextAction: "Process" })));
    }
    return mockActionResponse(true, affected.length ? "Auto-remediation applied." : "No eligible auto-remediation actions found.", state, affected);
  }

  const res = await fetch(`${BASE}/auto-remediate`, { method: "POST", headers: roleHeaders() });
  if (!res.ok) throw new Error(`auto-remediate ${res.status}`);
  return (await res.json()) as ActionResponse;
}


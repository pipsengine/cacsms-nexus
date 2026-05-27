import type { AuditRecord, Mt5Role } from "@/modules/mt5-infrastructure-and-broker-connectivity/mt5-control-center/types/mt5-control-center.types";
import {
  calculateQueueHealthScore,
  computePrioritySlaSummary,
  deriveSlaStatus,
  detectBottlenecks,
  generateQueueDiagnostics,
  prioritizeQueue,
  safeRetryDecision
} from "@/modules/mt5-infrastructure-and-broker-connectivity/execution-queue/algorithms/execution-queue.algorithms";
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
  QueueDiagnostic,
  QueueException,
  QueueLog
} from "@/modules/mt5-infrastructure-and-broker-connectivity/execution-queue/types/execution-queue.types";
import { resolveMt5Role } from "../../_lib/access";
import { bindPersistedMt5State, ensureMt5ModuleHydrated } from "../../_lib/persistence";

const state = bindPersistedMt5State("execution-queue", () => ({
  queuePaused: false,
  emergencyStopActive: false,
  items: [] as ExecutionQueueItem[],
  feedback: [] as ExecutionFeedback[],
  logs: [] as QueueLog[],
  bottlenecks: [] as QueueBottleneck[],
  audits: [] as AuditRecord[]
}));

await ensureMt5ModuleHydrated("execution-queue");

export function resetExecutionQueueState(override?: { items?: ExecutionQueueItem[]; feedback?: ExecutionFeedback[]; logs?: QueueLog[]; bottlenecks?: QueueBottleneck[] }) {
  state.queuePaused = false;
  state.emergencyStopActive = false;
  state.items = override?.items ?? [];
  state.feedback = override?.feedback ?? [];
  state.logs = override?.logs ?? [];
  state.bottlenecks = override?.bottlenecks ?? [];
  state.audits = [];
}

const permissions: Record<
  | "process"
  | "pauseResume"
  | "retry"
  | "cancel"
  | "validate"
  | "reassign"
  | "diagnostics"
  | "autoRemediate"
  | "emergencyStop",
  Mt5Role[]
> = {
  process: ["Super Admin", "Trading Admin"],
  pauseResume: ["Super Admin", "Trading Admin"],
  retry: ["Super Admin", "Trading Admin"],
  cancel: ["Super Admin", "Trading Admin"],
  validate: ["Super Admin", "Trading Admin"],
  reassign: ["Super Admin", "Infrastructure Admin"],
  diagnostics: ["Super Admin", "Infrastructure Admin"],
  autoRemediate: ["Super Admin", "Infrastructure Admin"],
  emergencyStop: ["Super Admin"]
};

function authorize(role: Mt5Role, action: keyof typeof permissions) {
  if (!permissions[action].includes(role)) throw new Error(`Role "${role}" is not authorized to perform execution queue ${action}.`);
}

function audit(role: Mt5Role, action: string, entityId: string, oldValue: unknown, newValue: unknown, request?: Request) {
  state.audits.unshift({
    id: `queue-audit-${Date.now()}-${state.audits.length}`,
    userId: request?.headers.get("x-user-id") ?? role.toLowerCase().replace(/\s+/g, "-"),
    action,
    module: "Execution Queue",
    entityId,
    oldValue,
    newValue,
    ipAddress: request?.headers.get("x-forwarded-for") ?? "system",
    userAgent: request?.headers.get("user-agent") ?? "autonomous-execution-queue",
    timestamp: new Date().toISOString()
  });
}

function addLog(queueId: string | "ALL", orderId: string | "ALL", eventType: string, severity: QueueLog["severity"], message: string, actionTaken: string, result: string) {
  state.logs.unshift({
    id: `queue-log-${Date.now()}-${state.logs.length}`,
    queueId,
    orderId,
    eventType,
    severity,
    sourceModule: "Execution Queue",
    message,
    actionTaken,
    result,
    createdAt: new Date().toISOString()
  });
  state.logs = state.logs.slice(0, 250);
}

export function executionQueueRole(request?: Request): Mt5Role {
  return resolveMt5Role(request);
}

function refreshDerived() {
  const now = Date.now();
  state.items = state.items.map((it) => {
    const age = Math.max(0, Math.round((now - new Date(it.createdAt).getTime()) / 1000));
    const next: ExecutionQueueItem = { ...it, queueAgeSeconds: age };
    return { ...next, slaStatus: deriveSlaStatus(next) };
  });
}

function actionResponse(ok: boolean, message: string, affectedQueueIds?: string[]): ActionResponse {
  return {
    meta: { timestamp: new Date().toISOString(), queuePaused: state.queuePaused, emergencyStopActive: state.emergencyStopActive },
    ok,
    message,
    affectedQueueIds
  };
}

function queueItem(queueId: string) {
  const item = state.items.find((it) => it.queueId === queueId);
  if (!item) throw new Error("Queue item not found.");
  return item;
}

function buildKpis(items: ExecutionQueueItem[], score: number): ExecutionQueueSummaryResponse["kpis"] {
  const now = new Date().toISOString();
  const count = (p: (i: ExecutionQueueItem) => boolean) => items.filter(p).length;
  const total = items.length;
  const avgWait = Math.round(items.reduce((sum, it) => sum + it.queueAgeSeconds, 0) / Math.max(1, total));
  const status = (value: number, warn: number, critical: number) => (value >= critical ? "Critical" : value >= warn ? "Degraded" : "Healthy");

  return [
    { label: "Total Queue Items", value: String(total), status: "Healthy", detail: "All execution requests in queue", updatedAt: now },
    { label: "Pending Execution", value: String(count((i) => i.queueStatus === "Pending")), status: status(count((i) => i.queueStatus === "Pending"), 10, 20), detail: "Awaiting validation", updatedAt: now },
    { label: "Validated Items", value: String(count((i) => i.queueStatus === "Validated")), status: "Healthy", detail: "Passed pre-execution validation", updatedAt: now },
    { label: "Processing Items", value: String(count((i) => i.queueStatus === "Processing")), status: "Watch", detail: "In pipeline processing", updatedAt: now },
    { label: "Routed Items", value: String(count((i) => i.queueStatus === "Routed")), status: "Watch", detail: "Awaiting EA delivery / MT5 feedback", updatedAt: now },
    { label: "Executed Items", value: String(count((i) => i.queueStatus === "Executed")), status: "Healthy", detail: "MT5 execution confirmed", updatedAt: now },
    { label: "Failed Items", value: String(count((i) => i.queueStatus === "Failed")), status: status(count((i) => i.queueStatus === "Failed"), 3, 7), detail: "Failed delivery or feedback", updatedAt: now },
    { label: "Retried Items", value: String(count((i) => i.queueStatus === "Retried")), status: status(count((i) => i.queueStatus === "Retried"), 3, 7), detail: "Retry queued", updatedAt: now },
    { label: "Cancelled Items", value: String(count((i) => i.queueStatus === "Cancelled")), status: "Healthy", detail: "Cancelled by operator", updatedAt: now },
    { label: "Blocked Items", value: String(count((i) => i.queueStatus === "Blocked")), status: status(count((i) => i.queueStatus === "Blocked"), 3, 7), detail: "Blocked by gates", updatedAt: now },
    { label: "Average Queue Wait Time", value: `${avgWait}s`, status: avgWait >= 600 ? "Degraded" : "Healthy", detail: "Average age across queue", updatedAt: now },
    { label: "Queue Health Score", value: `${score}/100`, status: score >= 75 ? "Healthy" : score >= 60 ? "Degraded" : "Critical", detail: "Throughput + SLA adherence", updatedAt: now }
  ];
}

function buildWorkflow(items: ExecutionQueueItem[]): ExecutionQueueSummaryResponse["workflow"] {
  const total = Math.max(1, items.length);
  const avgDelay = Math.round(items.reduce((sum, it) => sum + it.queueAgeSeconds, 0) / total);
  const last = items[0]?.queueId ?? "—";
  const failed = items.filter((i) => i.queueStatus === "Failed" || i.queueStatus === "Blocked").length;

  const pending = items.filter((i) => i.queueStatus === "Pending").length;
  const validated = items.filter((i) => i.queueStatus === "Validated").length;
  const processing = items.filter((i) => i.queueStatus === "Processing").length;
  const routed = items.filter((i) => i.queueStatus === "Routed").length;
  const executed = items.filter((i) => i.queueStatus === "Executed").length;

  const step = (title: string, status: ExecutionQueueSummaryResponse["workflow"][number]["status"], itemCount: number, failedCount: number, aiRecommendation?: string) => ({
    title,
    status,
    itemCount,
    failedCount,
    averageDelaySeconds: avgDelay,
    lastProcessedItem: last,
    aiRecommendation
  });

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
  ];
}

function buildPermissions(role: Mt5Role): ExecutionQueueSummaryResponse["permissions"] {
  return {
    role,
    canProcess: permissions.process.includes(role),
    canPauseResume: permissions.pauseResume.includes(role),
    canRetry: permissions.retry.includes(role),
    canCancel: permissions.cancel.includes(role),
    canValidate: permissions.validate.includes(role),
    canReassignRoute: permissions.reassign.includes(role),
    canEmergencyStop: permissions.emergencyStop.includes(role),
    canDiagnostics: permissions.diagnostics.includes(role),
    canAutoRemediate: permissions.autoRemediate.includes(role)
  };
}

export function buildSummary(role: Mt5Role): ExecutionQueueSummaryResponse {
  refreshDerived();
  const health = calculateQueueHealthScore(state.items);
  return {
    meta: { timestamp: new Date().toISOString(), currentRole: role, queuePaused: state.queuePaused, emergencyStopActive: state.emergencyStopActive },
    kpis: buildKpis(state.items, health.score),
    health,
    workflow: buildWorkflow(state.items),
    permissions: buildPermissions(role)
  };
}

export function listItems(params: { search?: string; status?: string; priority?: string; page?: number; pageSize?: number }): ExecutionQueueItemsResponse {
  refreshDerived();
  const search = params.search?.trim().toLowerCase() ?? "";
  const status = params.status ?? "all";
  const priority = params.priority ?? "all";

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

  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 60;
  const start = (page - 1) * pageSize;
  const items = filtered.slice(start, start + pageSize);
  return { meta: { timestamp: new Date().toISOString(), total: filtered.length, page, pageSize }, items };
}

export function itemDetail(queueId: string): ExecutionQueueItemResponse {
  refreshDerived();
  return { meta: { timestamp: new Date().toISOString() }, item: queueItem(queueId) };
}

export function validateItem(queueId: string, role: Mt5Role, request?: Request) {
  authorize(role, "validate");
  if (state.emergencyStopActive) throw new Error("Validation blocked while emergency stop is active.");
  const item = queueItem(queueId);
  const old = { queueStatus: item.queueStatus, validationStatus: item.validationStatus, riskStatus: item.riskStatus };
  item.validationStatus = "Passed";
  if (item.queueStatus === "Pending" || item.queueStatus === "Blocked") item.queueStatus = "Validated";
  item.updatedAt = new Date().toISOString();
  item.nextAction = "Process";
  addLog(item.queueId, item.orderId, "Validate", "Info", "Pre-execution validation forced by operator.", "Validate", "Passed");
  audit(role, "Queue item validated", queueId, old, { queueStatus: item.queueStatus, validationStatus: item.validationStatus }, request);
  return actionResponse(true, "Queue item validated.", [queueId]);
}

export function retryItem(queueId: string, role: Mt5Role, request?: Request) {
  authorize(role, "retry");
  if (state.emergencyStopActive) throw new Error("Retry blocked while emergency stop is active.");
  if (state.queuePaused) throw new Error("Retry blocked while execution queue is paused.");

  const item = queueItem(queueId);
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
  if (!decision.safe) {
    addLog(item.queueId, item.orderId, "Retry", "Critical", "Unsafe retry blocked by safety rules.", "Block retry", decision.failures.join("; "));
    audit(role, "Unsafe retry blocked", queueId, item.retryCount, decision.failures, request);
    throw new Error(`Unsafe retry blocked: ${decision.failures.join(", ")}.`);
  }

  const old = { queueStatus: item.queueStatus, retryCount: item.retryCount, routingStatus: item.routingStatus };
  item.retryCount += 1;
  item.lastRetryAt = new Date().toISOString();
  item.queueStatus = "Retried";
  item.executionStatus = "Pending";
  item.deliveryStatus = "Pending";
  item.failureReason = undefined;
  item.updatedAt = new Date().toISOString();
  item.nextAction = "Await delivery";
  addLog(item.queueId, item.orderId, "Retry", "Warning", "Safe retry queued after validation checks.", "Retry queued", "Pending");
  audit(role, "Queue item retry queued", queueId, old, { queueStatus: item.queueStatus, retryCount: item.retryCount }, request);
  return actionResponse(true, "Retry queued.", [queueId]);
}

export function cancelItem(queueId: string, role: Mt5Role, request?: Request) {
  authorize(role, "cancel");
  const item = queueItem(queueId);
  if (item.queueStatus === "Executed") throw new Error("Executed items cannot be cancelled.");
  const old = item.queueStatus;
  item.queueStatus = "Cancelled";
  item.deliveryStatus = "Cancelled";
  item.executionStatus = "Not Sent";
  item.updatedAt = new Date().toISOString();
  item.nextAction = "Closed";
  addLog(item.queueId, item.orderId, "Cancel", "Warning", "Queue item cancelled by authorized operator.", "Cancel item", "Cancelled");
  audit(role, "Queue item cancelled", queueId, old, item.queueStatus, request);
  return actionResponse(true, "Queue item cancelled.", [queueId]);
}

export function reassignRoute(queueId: string, role: Mt5Role, request?: Request) {
  authorize(role, "reassign");
  const item = queueItem(queueId);
  const old = { routingStatus: item.routingStatus, assignedRoute: item.assignedRoute };
  item.routingStatus = "Reassigned";
  item.assignedRoute = `route-${Math.random() > 0.5 ? "A" : "B"}-${Math.floor(Math.random() * 99)}`;
  item.updatedAt = new Date().toISOString();
  item.nextAction = "Retry if safe";
  addLog(item.queueId, item.orderId, "Reassign Route", "Info", "Route reassigned due to dependency health.", "Reassign route", item.assignedRoute);
  audit(role, "Queue item route reassigned", queueId, old, { routingStatus: item.routingStatus, assignedRoute: item.assignedRoute }, request);
  return actionResponse(true, "Route reassigned.", [queueId]);
}

export function processQueue(role: Mt5Role, request?: Request) {
  authorize(role, "process");
  if (state.emergencyStopActive) throw new Error("Processing blocked while emergency stop is active.");
  if (state.queuePaused) throw new Error("Processing blocked while execution queue is paused.");

  refreshDerived();
  const candidates = prioritizeQueue(state.items)
    .filter((it) => it.queueStatus === "Pending" || it.queueStatus === "Validated" || it.queueStatus === "Processing" || it.queueStatus === "Routed")
    .slice(0, 10);

  const affected: string[] = [];
  for (const it of candidates) {
    const old = it.queueStatus;
    if (it.queueStatus === "Pending") {
      it.queueStatus = "Validated";
      it.validationStatus = "Passed";
      it.nextAction = "Process";
    } else if (it.queueStatus === "Validated") {
      it.queueStatus = "Processing";
      it.nextAction = "Assign route";
    } else if (it.queueStatus === "Processing") {
      it.queueStatus = "Routed";
      it.routingStatus = "Assigned";
      it.deliveryStatus = "Pending";
      it.nextAction = "Await MT5 feedback";
    } else if (it.queueStatus === "Routed") {
      it.queueStatus = "Executed";
      it.deliveryStatus = "Delivered";
      it.executionStatus = "Executed";
      it.nextAction = "Closed";
      const ticket = `45${900_000 + Math.floor(Math.random() * 9000)}`;
      state.feedback.unshift({
        id: `fb-${Date.now()}-${it.queueId}`,
        queueId: it.queueId,
        orderId: it.orderId,
        mt5Ticket: ticket,
        deliveredAt: new Date().toISOString(),
        executedAt: new Date().toISOString(),
        requestedPrice: it.entryPrice,
        executedPrice: it.entryPrice,
        slippagePoints: 0.2,
        executionTimeMs: 180,
        responseCode: "OK",
        responseMessage: "Execution confirmed",
        finalStatus: "Executed",
        createdAt: new Date().toISOString()
      } satisfies ExecutionFeedback);
    }
    it.updatedAt = new Date().toISOString();
    affected.push(it.queueId);
    addLog(it.queueId, it.orderId, "Process", "Info", `Queue item transitioned from ${old} to ${it.queueStatus}.`, "Advance pipeline", it.queueStatus);
  }

  audit(role, "Execution queue processed", "queue", null, { affected: affected.length }, request);
  addLog("ALL", "ALL", "Process Queue", "Info", `Processed ${affected.length} queue item(s).`, "Process queue", "Ok");
  return actionResponse(true, `Processed ${affected.length} queue item(s).`, affected);
}

export function pauseQueue(role: Mt5Role, request?: Request) {
  authorize(role, "pauseResume");
  const old = state.queuePaused;
  state.queuePaused = true;
  addLog("ALL", "ALL", "Pause", "Warning", "Execution queue paused.", "Pause queue", "Paused");
  audit(role, "Execution queue paused", "queue", old, true, request);
  return actionResponse(true, "Queue paused.");
}

export function resumeQueue(role: Mt5Role, request?: Request) {
  authorize(role, "pauseResume");
  if (state.emergencyStopActive) throw new Error("Queue cannot resume while emergency stop is active.");
  const old = state.queuePaused;
  state.queuePaused = false;
  addLog("ALL", "ALL", "Resume", "Info", "Execution queue resumed.", "Resume queue", "Running");
  audit(role, "Execution queue resumed", "queue", old, false, request);
  return actionResponse(true, "Queue resumed.");
}

export function emergencyStop(role: Mt5Role, request?: Request) {
  authorize(role, "emergencyStop");
  const old = { queuePaused: state.queuePaused, emergencyStopActive: state.emergencyStopActive };
  state.emergencyStopActive = true;
  state.queuePaused = true;
  addLog("ALL", "ALL", "Emergency Stop", "Critical", "Emergency stop activated for execution queue.", "Stop execution", "Blocked");
  audit(role, "Emergency stop activated", "queue", old, { queuePaused: true, emergencyStopActive: true }, request);
  return actionResponse(true, "Emergency stop activated.");
}

export function prioritySla(): PrioritySlaResponse {
  refreshDerived();
  const autoBottlenecks = detectBottlenecks(state.items);
  const summary = computePrioritySlaSummary(state.items, autoBottlenecks);
  return { meta: { timestamp: new Date().toISOString() }, summary };
}

export function bottlenecks(): BottlenecksResponse {
  refreshDerived();
  const auto = detectBottlenecks(state.items);
  return { meta: { timestamp: new Date().toISOString() }, bottlenecks: [...state.bottlenecks, ...auto].slice(0, 12) };
}

function exceptionRows(items: ExecutionQueueItem[]): QueueException[] {
  const relevant = items.filter((it) => it.queueStatus === "Failed" || it.queueStatus === "Retried" || it.queueStatus === "Blocked" || it.slaStatus === "Expired");
  return relevant.map((it) => {
    const decision = safeRetryDecision(it, {
      emergencyStopActive: false,
      queuePaused: false,
      duplicateClear: it.duplicateCheckStatus === "Passed",
      priceWithinTolerance: true,
      dependenciesHealthy:
        it.accountReadinessStatus === "Ready" &&
        it.brokerReadinessStatus === "Ready" &&
        it.terminalReadinessStatus === "Ready" &&
        it.eaBridgeReadinessStatus === "Ready"
    });
    const retryEligibility = decision.safe && it.queueStatus !== "Blocked" ? "Eligible" : "Blocked";
    const reason = it.failureReason ?? (it.queueStatus === "Blocked" ? "Blocked by safety gates" : "Requires review");
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
      retryEligibility,
      blockReason: it.queueStatus === "Blocked" ? reason : undefined,
      aiExplanation: it.queueStatus === "Blocked" ? "Safety gates blocked execution; do not override without risk approval." : "Validate pre-execution checks and retry only when safe.",
      requiredAction
    } satisfies QueueException;
  });
}

export function exceptions(): ExceptionsResponse {
  refreshDerived();
  const rows = exceptionRows(state.items);
  return { meta: { timestamp: new Date().toISOString(), total: rows.length }, exceptions: rows };
}

export function executionFeedback(): FeedbackResponse {
  return { meta: { timestamp: new Date().toISOString(), total: state.feedback.length }, feedback: state.feedback };
}

export function logs(): LogsResponse {
  return { meta: { timestamp: new Date().toISOString(), total: state.logs.length }, logs: state.logs };
}

export function aiDiagnostics(): DiagnosticsResponse {
  refreshDerived();
  const auto = detectBottlenecks(state.items);
  const diagnostics = generateQueueDiagnostics(state.items, auto);
  return { meta: { timestamp: new Date().toISOString() }, diagnostics };
}

export function autoRemediate(role: Mt5Role, request?: Request) {
  authorize(role, "autoRemediate");
  refreshDerived();
  const auto = detectBottlenecks(state.items);
  const diags = generateQueueDiagnostics(state.items, auto);
  const eligible = diags.filter((d) => d.autoFixEligible && d.affectedQueueId).slice(0, 8);
  const affected: string[] = [];

  for (const d of eligible) {
    const id = d.affectedQueueId!;
    const it = state.items.find((x) => x.queueId === id);
    if (!it) continue;
    const old = it.queueStatus;
    if (it.slaStatus === "Expired") {
      it.queueStatus = "Cancelled";
      it.nextAction = "Closed";
      it.updatedAt = new Date().toISOString();
      addLog(it.queueId, it.orderId, "Auto-Remediate", "Warning", "Expired queue item cancelled by auto-remediation.", "Cancel expired", "Cancelled");
      affected.push(id);
      audit(role, "Auto-remediation cancelled expired item", id, old, it.queueStatus, request);
      continue;
    }
    it.validationStatus = "Passed";
    it.riskStatus = "Passed";
    if (it.queueStatus === "Blocked") it.queueStatus = "Validated";
    it.updatedAt = new Date().toISOString();
    it.nextAction = "Process";
    addLog(it.queueId, it.orderId, "Auto-Remediate", "Info", "Auto-remediation refreshed validation and risk gates.", "Refresh gates", "Validated");
    affected.push(id);
    audit(role, "Auto-remediation refreshed gates", id, old, it.queueStatus, request);
  }

  addLog("ALL", "ALL", "Auto-Remediate", "Info", "Auto-remediation workflow completed.", "Apply safe remediation", `Affected: ${affected.length}`);
  return actionResponse(true, affected.length ? "Auto-remediation applied." : "No eligible auto-remediation actions found.", affected);
}

export function audits() {
  return state.audits;
}

import type { AuditRecord, Mt5Role } from "@/modules/mt5-infrastructure-and-broker-connectivity/mt5-control-center/types/mt5-control-center.types";
import { calculateRoutingHealth, duplicateProtection, evaluateRetrySafety, selectSmartRoute, validatePreRoute } from "@/modules/mt5-infrastructure-and-broker-connectivity/order-router/algorithms/order-router.algorithms";
import { createOrderRouterSeed } from "@/modules/mt5-infrastructure-and-broker-connectivity/order-router/data/order-router.mock";
import type { OrderRoute, RouterLog, RouterResponse } from "@/modules/mt5-infrastructure-and-broker-connectivity/order-router/types/order-router.types";
import { resolveMt5Role } from "../../_lib/access";

const seed = createOrderRouterSeed();
const state = { ...seed, audits: [] as AuditRecord[], routingPaused: false, emergencyStopActive: false, lastSyncAt: new Date().toISOString() };

export function orderRouterRole(request?: Request): Mt5Role { return resolveMt5Role(request); }

const permissions: Record<string, Mt5Role[]> = {
  sync: ["Super Admin", "Infrastructure Admin", "Trading Admin"],
  diagnostics: ["Super Admin", "Infrastructure Admin"],
  pauseResume: ["Super Admin", "Trading Admin"],
  emergencyStop: ["Super Admin"],
  retry: ["Super Admin", "Trading Admin"],
  cancel: ["Super Admin", "Trading Admin"],
  revalidate: ["Super Admin", "Risk Manager", "Trading Admin"],
  reviewBlocked: ["Super Admin", "Risk Manager"],
  autoRemediate: ["Super Admin", "Infrastructure Admin"]
};
function authorize(role: Mt5Role, action: keyof typeof permissions) {
  if (!permissions[action].includes(role)) throw new Error(`Role "${role}" is not authorized to perform router ${action}.`);
}
function confirm(confirmed?: boolean) {
  if (!confirmed) throw new Error("Confirmation is required for this restricted order router action.");
}
function audit(role: Mt5Role, action: string, entityId: string, oldValue: unknown, newValue: unknown, request?: Request) {
  state.audits.unshift({ id: `router-audit-${Date.now()}-${state.audits.length}`, userId: request?.headers.get("x-user-id") ?? role.toLowerCase().replace(/\s+/g, "-"), action, module: "Order Router", entityId, oldValue, newValue, ipAddress: request?.headers.get("x-forwarded-for") ?? "system", userAgent: request?.headers.get("user-agent") ?? "autonomous-order-router", timestamp: new Date().toISOString() });
}
function routeById(id: string) {
  const route = state.routes.find((item) => item.id === id);
  if (!route) throw new Error("MT5 order route not found.");
  return route;
}
function addLog(route: Pick<OrderRoute, "id" | "orderId">, eventType: RouterLog["eventType"], severity: RouterLog["severity"], message: string, actionTaken: string, result: string) {
  state.logs.unshift({ id: `router-log-${Date.now()}-${state.logs.length}`, routeId: route.id, orderId: route.orderId, eventType, severity, sourceModule: "Order Router", message, actionTaken, result, resolved: false, createdAt: new Date().toISOString() });
}
function routeContext(route: OrderRoute) {
  return {
    signalApproved: route.signalValidationStatus === "Passed",
    strategyActive: true,
    accountSynced: route.accountReadinessStatus === "Passed",
    accountTradingEnabled: route.accountReadinessStatus === "Passed",
    brokerExecutionEnabled: route.brokerReadinessStatus === "Passed",
    terminalOnline: route.brokerReadinessStatus === "Passed",
    eaBridgeActive: route.deliveryStatus !== "Blocked" || route.accountReadinessStatus === "Passed",
    symbolMapped: route.symbolMappingStatus === "Passed",
    spreadAcceptable: route.marketConditionStatus === "Passed",
    marginSufficient: route.marginCheckStatus === "Passed",
    newsBlackoutClear: route.marketConditionStatus === "Passed",
    duplicateClear: route.duplicateCheckStatus === "Passed",
    riskApproved: route.riskStatus === "Passed",
    emergencyStopActive: state.emergencyStopActive
  };
}

export function routes() { return state.routes; }
export function routeDetail(id: string) { return routeById(id); }
export function channels() { return state.channels; }
export function blockedOrders() { return state.blockedOrders; }
export function executionFeedback() { return state.feedback; }
export function routerLogs() { return state.logs; }
export function exceptions() { return state.logs.filter((log) => !log.resolved || log.severity === "Critical"); }
export function diagnostics() { return state.diagnostics; }
export function routerAudits() { return state.audits; }

export function syncRoutingStatus(role: Mt5Role, confirmed: boolean, request?: Request) {
  authorize(role, "sync"); confirm(confirmed);
  state.lastSyncAt = new Date().toISOString();
  audit(role, "Routing status synchronized", "all-routes", null, { routes: state.routes.length, timestamp: state.lastSyncAt }, request);
  return routes();
}
export function runRouterDiagnostics(role: Mt5Role, confirmed: boolean, request?: Request) {
  authorize(role, "diagnostics"); confirm(confirmed);
  audit(role, "Router diagnostics run", "router", null, { findings: state.diagnostics.length }, request);
  return { completedAt: new Date().toISOString(), diagnostics: state.diagnostics };
}
export function setRoutingPaused(paused: boolean, role: Mt5Role, confirmed: boolean, request?: Request) {
  authorize(role, "pauseResume"); confirm(confirmed);
  if (!paused && state.emergencyStopActive) throw new Error("Routing cannot resume while emergency stop is active.");
  const old = state.routingPaused;
  state.routingPaused = paused;
  addLog({ id: "router", orderId: "ALL" }, "Routing State", paused ? "Warning" : "Info", `Order routing ${paused ? "paused" : "resumed"}.`, "Routing state changed", paused ? "New deliveries suspended" : "Validated delivery enabled");
  audit(role, paused ? "Order routing paused" : "Order routing resumed", "router", old, paused, request);
  return { routingPaused: paused, emergencyStopActive: state.emergencyStopActive };
}
export function emergencyStopRouting(role: Mt5Role, confirmed: boolean, request?: Request) {
  authorize(role, "emergencyStop"); confirm(confirmed);
  const old = { routingPaused: state.routingPaused, emergencyStopActive: state.emergencyStopActive };
  state.emergencyStopActive = true;
  state.routingPaused = true;
  addLog({ id: "router", orderId: "ALL" }, "Emergency Stop", "Critical", "Emergency stop activated for every MT5 routing channel.", "Block new delivery and retries", "Routing suspended");
  audit(role, "Emergency stop routing activated", "router", old, { routingPaused: true, emergencyStopActive: true }, request);
  return { routingPaused: true, emergencyStopActive: true };
}
export function revalidateRoute(id: string, role: Mt5Role, confirmed: boolean, request?: Request) {
  authorize(role, "revalidate"); confirm(confirmed);
  const route = routeById(id);
  const duplicate = duplicateProtection(route, state.routes);
  route.duplicateCheckStatus = duplicate.blocked ? "Failed" : "Passed";
  const validation = validatePreRoute(routeContext(route));
  if (!validation.approved) {
    route.routingStatus = "Blocked";
    route.deliveryStatus = "Blocked";
    route.executionStatus = "Not Sent";
    route.failureReason = validation.reason;
    addLog(route, "Validation", "Critical", `Route validation failed: ${validation.reason}.`, "Route held", "Blocked before delivery");
  } else {
    route.failureReason = undefined;
    addLog(route, "Validation", "Info", "Pre-route safety validation passed.", "Risk decision refreshed", "Eligible for controlled routing");
  }
  route.updatedAt = new Date().toISOString();
  audit(role, "Order route revalidated", id, null, validation, request);
  return { route, validation };
}
export function retryRoute(id: string, role: Mt5Role, confirmed: boolean, request?: Request) {
  authorize(role, "retry"); confirm(confirmed);
  if (state.routingPaused || state.emergencyStopActive) throw new Error("Retry blocked while order routing is paused or emergency stopped.");
  const route = routeById(id);
  const feedback = state.feedback.find((item) => item.routeId === id);
  const duplicate = duplicateProtection(route, state.routes);
  const selection = selectSmartRoute(state.channels);
  const currentChannel = state.channels.find((channel) => channel.eaInstanceId === route.eaInstanceId);
  const target = currentChannel?.riskLevel === "Healthy" ? currentChannel : route.fallbackRouteAvailable ? selection.primaryRoute : currentChannel;
  const safety = evaluateRetrySafety(route, {
    feedbackConfirmsFailure: feedback?.executionStatus === "Rejected",
    duplicateClear: !duplicate.blocked,
    priceWithinTolerance: true,
    riskRevalidated: validatePreRoute({ ...routeContext(route), duplicateClear: !duplicate.blocked }).approved,
    targetHealthy: Boolean(target?.tradingEnabled && target.riskLevel === "Healthy")
  });
  if (!safety.safe) {
    addLog(route, "Blocked", "Critical", "Unsafe retry request rejected.", "Prevent duplicate or unsafe execution", safety.failures.join("; "));
    audit(role, "Unsafe order retry blocked", id, route.routingStatus, safety.failures, request);
    throw new Error(`Unsafe retry blocked: ${safety.failures.join(", ")}.`);
  }
  const old = { routingStatus: route.routingStatus, eaInstanceId: route.eaInstanceId, brokerName: route.brokerName };
  if (target && target.id !== currentChannel?.id) {
    route.eaInstanceId = target.eaInstanceId;
    route.eaInstanceName = target.eaInstanceName;
    route.terminalName = target.terminalName;
    route.brokerName = target.brokerName;
    route.accountLogin = target.accountLogin;
  }
  route.routingStatus = "Retried";
  route.deliveryStatus = "Pending";
  route.executionStatus = "Pending";
  route.failureReason = undefined;
  route.updatedAt = new Date().toISOString();
  addLog(route, "Retried", "Info", "Failed delivery passed retry safety validation.", "Queued on healthy channel", target?.channelUuid ?? "No target");
  audit(role, "Safe route retry queued", id, old, { routingStatus: route.routingStatus, channel: target?.channelUuid }, request);
  return route;
}
export function cancelRoute(id: string, role: Mt5Role, confirmed: boolean, request?: Request) {
  authorize(role, "cancel"); confirm(confirmed);
  const route = routeById(id);
  if (route.executionStatus === "Executed" || route.mt5Ticket) throw new Error("Executed orders cannot be cancelled through the router.");
  const old = route.routingStatus;
  route.routingStatus = "Cancelled";
  route.deliveryStatus = "Cancelled";
  route.executionStatus = "Cancelled";
  route.updatedAt = new Date().toISOString();
  addLog(route, "Cancelled", "Warning", "Pending route cancelled by authorized operator.", "Cancel delivery", "No future execution permitted");
  audit(role, "Order route cancelled", id, old, route.routingStatus, request);
  return route;
}
export function autoRemediateRouter(diagnosticId: string, role: Mt5Role, confirmed: boolean, request?: Request) {
  authorize(role, "autoRemediate"); confirm(confirmed);
  const diagnostic = state.diagnostics.find((item) => item.id === diagnosticId);
  if (!diagnostic) throw new Error("Router diagnostic not found.");
  if (!diagnostic.autoFixEligible || !diagnostic.routeId) throw new Error("This diagnostic cannot be automatically remediated.");
  diagnostic.autoFixStatus = "Running";
  const route = routeById(diagnostic.routeId);
  addLog(route, "Diagnostics", "Info", "AI remediation initiated safe revalidation workflow.", "Check channel and risk gates", "Await controlled retry approval");
  audit(role, "Router auto-remediation initiated", diagnosticId, "Available", diagnostic.autoFixStatus, request);
  return { diagnostic, route, recommendedRoute: selectSmartRoute(state.channels) };
}

export function buildOrderRouterResponse(role: Mt5Role = "Infrastructure Admin"): RouterResponse {
  const now = new Date().toISOString();
  const health = calculateRoutingHealth(state.routes, state.channels);
  const total = state.routes.length || 1;
  const avg = (select: (route: OrderRoute) => number) => Math.round(state.routes.reduce((sum, route) => sum + select(route), 0) / total);
  const highestRisk = state.routes.find((route) => route.routingStatus === "Blocked") ?? state.routes[0];
  const titles = ["Signal Approved", "Risk Validation", "Account Readiness", "Broker Readiness", "Symbol Mapping", "Duplicate Check", "EA Bridge Delivery", "MT5 Execution", "Execution Feedback", "Audit Logged"];
  const failures = state.routes.filter((route) => route.routingStatus === "Blocked" || route.routingStatus === "Failed").length;
  return {
    meta: { timestamp: now, currentRole: role, streamEndpoint: "/api/mt5/order-router/events-stream", monitoringMode: "Autonomous Audited Routing", routingPaused: state.routingPaused, emergencyStopActive: state.emergencyStopActive },
    kpis: [
      { label: "Total Orders Routed", value: String(state.routes.length), status: "Healthy", detail: "Validated queue records", updatedAt: now },
      { label: "Orders Pending Routing", value: String(state.routes.filter((route) => route.routingStatus === "Pending" || route.routingStatus === "Retried").length), status: "Pending", detail: "Awaiting delivery", updatedAt: now },
      { label: "Orders Successfully Delivered", value: String(state.routes.filter((route) => route.deliveryStatus === "Delivered").length), status: "Healthy", detail: "EA commands received", updatedAt: now },
      { label: "Orders Executed", value: String(state.routes.filter((route) => route.executionStatus === "Executed").length), status: "Healthy", detail: "MT5 tickets confirmed", updatedAt: now },
      { label: "Failed Routes", value: String(state.routes.filter((route) => route.routingStatus === "Failed").length), status: "Degraded", detail: "Delivery failures", updatedAt: now },
      { label: "Blocked by Risk Engine", value: String(state.blockedOrders.length), status: "Critical", detail: "Pre-route controls", updatedAt: now },
      { label: "Duplicate Orders Blocked", value: String(state.blockedOrders.filter((item) => item.blockReason === "Duplicate order").length), status: "Critical", detail: "Execution protection", updatedAt: now },
      { label: "Average Routing Latency", value: `${avg((route) => route.routingLatencyMs)} ms`, status: avg((route) => route.routingLatencyMs) > 150 ? "Degraded" : "Healthy", detail: "Nexus to bridge", updatedAt: now },
      { label: "Average Execution Response Time", value: `${avg((route) => route.executionResponseTimeMs)} ms`, status: "Watch", detail: "MT5 feedback", updatedAt: now },
      { label: "Active Routing Channels", value: String(state.channels.filter((channel) => channel.tradingEnabled).length), status: "Healthy", detail: "Execution enabled", updatedAt: now },
      { label: "Router Health Score", value: `${health.score}/100`, status: health.score >= 75 ? "Healthy" : health.score >= 60 ? "Degraded" : "Critical", detail: health.rating, updatedAt: now },
      { label: "Highest Risk Route", value: highestRisk.id, status: "Critical", detail: highestRisk.failureReason ?? "Monitor", updatedAt: now }
    ],
    health,
    workflow: titles.map((title, index) => ({
      title,
      status: failures && index >= 1 ? index >= 6 ? "Critical" : "Degraded" : "Healthy",
      orderCount: state.routes.length - (index ? failures : 0),
      failureCount: index ? failures : 0,
      averageDelayMs: avg((route) => route.routingLatencyMs),
      lastProcessedOrder: state.routes[0].orderId,
      aiRecommendation: title === "Duplicate Check" ? "Retain block for any equivalent executed order." : title === "EA Bridge Delivery" ? "Favor the lowest-latency healthy channel for retries." : undefined
    })),
    routes: state.routes, channels: state.channels, blockedOrders: state.blockedOrders, feedback: state.feedback, logs: state.logs, diagnostics: state.diagnostics, audits: state.audits,
    permissions: {
      role, canSync: permissions.sync.includes(role), canDiagnostics: permissions.diagnostics.includes(role), canPauseResume: permissions.pauseResume.includes(role), canEmergencyStop: permissions.emergencyStop.includes(role), canRetry: permissions.retry.includes(role), canCancel: permissions.cancel.includes(role), canRevalidate: permissions.revalidate.includes(role), canReviewBlocked: permissions.reviewBlocked.includes(role), canAutoRemediate: permissions.autoRemediate.includes(role)
    }
  };
}
export function routerSummary(role: Mt5Role) {
  const response = buildOrderRouterResponse(role);
  return { meta: response.meta, kpis: response.kpis, health: response.health, workflow: response.workflow, permissions: response.permissions };
}

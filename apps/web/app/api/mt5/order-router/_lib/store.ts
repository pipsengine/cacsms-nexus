import type { AuditRecord, Mt5Role } from "@/modules/mt5-infrastructure-and-broker-connectivity/mt5-control-center/types/mt5-control-center.types";
import { calculateRoutingHealth, duplicateProtection, evaluateRetrySafety, selectSmartRoute, validatePreRoute } from "@/modules/mt5-infrastructure-and-broker-connectivity/order-router/algorithms/order-router.algorithms";
import type { OrderRoute, RouterLog, RouterResponse, StrategySignalInput, StrategySignalResult } from "@/modules/mt5-infrastructure-and-broker-connectivity/order-router/types/order-router.types";
import {
  buildStrategySignalRoute,
  buildTradeCommandFromRoute,
  dispatchTradeCommandToEaBridge,
  resolveEaInstanceForDispatch
} from "../../_lib/ea-command-dispatch";
import { autonomousEnsureTradingChannel, bridgeInstances } from "../../ea-bridge/_lib/store";
import { ingestExecutionFromOrderRouter } from "../../slippage-monitor/_lib/store";
import { resolveMt5Role } from "../../_lib/access";
import type { AutonomousPipelineSource } from "../../_lib/autonomous-orchestrator";
import { bindPersistedMt5State, ensureMt5ModuleHydrated } from "../../_lib/persistence";

const state = bindPersistedMt5State("order-router", () => ({
  routes: [] as OrderRoute[],
  channels: [] as any[],
  blockedOrders: [] as any[],
  feedback: [] as any[],
  logs: [] as RouterLog[],
  diagnostics: [] as any[],
  audits: [] as AuditRecord[],
  routingPaused: false,
  emergencyStopActive: false,
  lastSyncAt: new Date().toISOString()
}));

await ensureMt5ModuleHydrated("order-router");

export function resetOrderRouterState(override?: Partial<typeof state>) {
  state.routes = override?.routes ?? [];
  state.channels = (override as any)?.channels ?? [];
  state.blockedOrders = (override as any)?.blockedOrders ?? [];
  state.feedback = (override as any)?.feedback ?? [];
  state.logs = override?.logs ?? [];
  state.diagnostics = (override as any)?.diagnostics ?? [];
  state.audits = [];
  state.routingPaused = false;
  state.emergencyStopActive = false;
  state.lastSyncAt = new Date().toISOString();
}

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
  autoRemediate: ["Super Admin", "Infrastructure Admin"],
  dispatch: ["Super Admin", "Infrastructure Admin", "Trading Admin"],
  submitTest: ["Super Admin", "Infrastructure Admin", "Trading Admin"],
  submitSignal: ["Super Admin", "Infrastructure Admin", "Trading Admin"]
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
  const instance = bridgeInstances().find((item) => item.id === route.eaInstanceId);
  const channel = state.channels.find((item) => item.eaInstanceId === route.eaInstanceId);
  const bridgeHealthy = Boolean(instance && instance.connectionStatus === "Healthy" && instance.tradingChannelEnabled !== false);
  return {
    signalApproved: route.signalValidationStatus === "Passed",
    strategyActive: true,
    accountSynced: route.accountReadinessStatus === "Passed",
    accountTradingEnabled: route.accountReadinessStatus === "Passed",
    brokerExecutionEnabled: route.brokerReadinessStatus === "Passed",
    terminalOnline: route.brokerReadinessStatus === "Passed" && bridgeHealthy,
    eaBridgeActive: bridgeHealthy && Boolean(channel?.tradingEnabled) && channel?.channelStatus !== "Offline",
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
  authorize(role, "sync");
  if (confirmed === false) confirm(confirmed);
  autonomousSyncRouting("heartbeat");
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
  syncChannelsFromEaBridge();
  const route = routeById(id);
  const feedback = state.feedback.find((item) => item.routeId === id);
  const duplicate = duplicateProtection(route, state.routes);
  const selection = selectSmartRoute(state.channels);
  const currentChannel = state.channels.find((channel) => channel.eaInstanceId === route.eaInstanceId);
  const target = currentChannel?.riskLevel === "Healthy" ? currentChannel : route.fallbackRouteAvailable ? selection.primaryRoute : currentChannel;
  const revalidation = validatePreRoute(
    target
      ? {
          ...routeContext(route),
          duplicateClear: !duplicate.blocked,
          eaBridgeActive: Boolean(target.tradingEnabled && target.channelStatus !== "Offline"),
          terminalOnline: target.channelStatus !== "Offline",
          brokerExecutionEnabled: true
        }
      : { ...routeContext(route), duplicateClear: !duplicate.blocked }
  );
  const safety = evaluateRetrySafety(route, {
    feedbackConfirmsFailure: feedback?.executionStatus === "Rejected",
    duplicateClear: !duplicate.blocked,
    priceWithinTolerance: true,
    riskRevalidated: revalidation.approved,
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
  return dispatchRouteToEa(id, role, true, request).route ?? route;
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

function syncChannelsFromEaBridge() {
  const instances = bridgeInstances();
  if (!instances.length) return;
  state.channels = instances.map((instance) => ({
    id: `channel-${instance.id}`,
    channelUuid: `channel-${instance.id}`,
    eaInstanceId: instance.id,
    eaInstanceName: instance.eaName,
    terminalName: instance.terminalName,
    brokerName: instance.brokerName,
    accountLogin: instance.accountLogin,
    symbolScope: instance.symbolScope ?? [],
    channelStatus: instance.connectionStatus === "Healthy" ? "Healthy" : instance.connectionStatus === "Offline" ? "Offline" : "Degraded",
    tradingEnabled: instance.tradingChannelEnabled,
    messageLatencyMs: instance.averageLatencyMs,
    commandSuccessRate: 0,
    queueBacklogCount: 0,
    lastCommandAt: instance.updatedAt,
    riskLevel: instance.connectionStatus === "Healthy" ? "Healthy" : "Degraded"
  }));
}

export function autonomousSyncRouting(_source: AutonomousPipelineSource) {
  syncChannelsFromEaBridge();
  state.lastSyncAt = new Date().toISOString();
  return state.channels;
}

function syncChannelsFromEaBridgeIfEmpty() {
  if (state.channels.length > 0) return;
  syncChannelsFromEaBridge();
}

function recordBlockedSignal(route: OrderRoute, blockReason: string, riskRuleTriggered: string) {
  const now = new Date().toISOString();
  route.routingStatus = "Blocked";
  route.deliveryStatus = "Blocked";
  route.executionStatus = "Not Sent";
  route.failureReason = blockReason;
  route.updatedAt = now;
  state.routes.unshift(route);
  state.blockedOrders.unshift({
    id: `blocked-${Date.now()}-${state.blockedOrders.length}`,
    orderId: route.orderId,
    signalId: route.signalId,
    accountLogin: route.accountLogin,
    brokerName: route.brokerName,
    symbol: route.symbol,
    direction: route.direction,
    volume: route.volume,
    blockReason,
    riskRuleTriggered,
    riskSeverity: "Critical",
    requiredAction: "Review the strategy signal or revalidate routing gates before resubmitting.",
    aiExplanation: `Autonomous routing blocked before EA bridge delivery: ${blockReason}`,
    resolved: false,
    createdAt: now
  });
  addLog(route, "Blocked", "Critical", blockReason, "Autonomous signal held", "Not sent");
}

function resolveRoutingChannel(input: StrategySignalInput) {
  syncChannelsFromEaBridge();
  const eaInstanceId = input.eaInstanceId?.trim();
  if (eaInstanceId) {
    const instance = bridgeInstances().find((item) => item.id === eaInstanceId);
    if (!instance) throw new Error(`EA instance "${eaInstanceId}" is not registered on the bridge.`);
    const channel = state.channels.find((item) => item.eaInstanceId === instance.id);
    return { instance, channel };
  }
  const accountLogin = input.accountLogin?.trim();
  if (accountLogin) {
    const channel = state.channels.find((item) => item.accountLogin === accountLogin && item.tradingEnabled);
    if (!channel) throw new Error(`No healthy routing channel found for account ${accountLogin}.`);
    return { instance: resolveEaInstanceForDispatch(channel.eaInstanceId), channel };
  }
  const selection = selectSmartRoute(state.channels);
  if (!selection.primaryRoute?.eaInstanceId) throw new Error("No active EA routing channel is available.");
  return { instance: resolveEaInstanceForDispatch(selection.primaryRoute.eaInstanceId), channel: selection.primaryRoute };
}

function ingestStrategySignalInternal(input: StrategySignalInput, role: Mt5Role, request?: Request): StrategySignalResult {
  if (state.routingPaused || state.emergencyStopActive) {
    throw new Error("Autonomous routing blocked while order routing is paused or emergency stopped.");
  }

  const symbol = input.symbol?.trim();
  if (!symbol) throw new Error("Symbol is required.");
  if (!Number.isFinite(input.volume) || input.volume <= 0) throw new Error("Volume must be a positive number.");

  const { instance, channel } = resolveRoutingChannel(input);
  autonomousEnsureTradingChannel(instance.id, role, request);
  syncChannelsFromEaBridge();
  const signalId = input.signalId?.trim() || `SIG-AUTO-${Date.now()}`;
  const orderId = `ORD-SIG-${Date.now()}`;
  const route = buildStrategySignalRoute({ signal: { ...input, symbol }, eaInstance: instance, signalId, orderId });

  const duplicate = duplicateProtection(route, state.routes);
  if (duplicate.blocked) {
    route.duplicateCheckStatus = "Failed";
    recordBlockedSignal(route, "Duplicate order", "Duplicate protection");
    audit(role, "Autonomous strategy signal blocked", route.id, null, { reason: "Duplicate order", matchedRouteId: duplicate.matchedRouteId }, request);
    return {
      ok: false,
      blocked: true,
      routeId: route.id,
      orderId: route.orderId,
      routingStatus: route.routingStatus,
      deliveryStatus: route.deliveryStatus,
      executionStatus: route.executionStatus,
      blockReason: route.failureReason,
      message: "Strategy signal blocked by duplicate protection."
    };
  }

  const validation = validatePreRoute(routeContext(route));
  if (!validation.approved) {
    recordBlockedSignal(route, validation.reason, validation.reason);
    audit(role, "Autonomous strategy signal blocked", route.id, null, validation, request);
    return {
      ok: false,
      blocked: true,
      routeId: route.id,
      orderId: route.orderId,
      routingStatus: route.routingStatus,
      deliveryStatus: route.deliveryStatus,
      executionStatus: route.executionStatus,
      blockReason: validation.reason,
      message: `Strategy signal blocked: ${validation.reason}`
    };
  }

  if (channel && channel.eaInstanceId !== instance.id) {
    route.eaInstanceId = channel.eaInstanceId;
    route.eaInstanceName = channel.eaInstanceName;
    route.terminalName = channel.terminalName;
    route.brokerName = channel.brokerName;
    route.accountLogin = channel.accountLogin;
    resolveEaInstanceForDispatch(channel.eaInstanceId);
  }

  state.routes.unshift(route);
  addLog(route, "Pending", "Info", "Approved strategy signal accepted for autonomous routing.", "Validate and dispatch", channel?.channelUuid ?? instance.id);

  const command = buildTradeCommandFromRoute(route);
  const result = dispatchTradeCommandToEaBridge({
    command,
    role,
    confirmed: true,
    request,
    enableTradingChannel: true
  });
  const dispatch = finalizeRouteDispatch(route, result, role, request);
  if (!dispatch.accepted) {
    const duplicateRejected = Boolean(result.reason?.toLowerCase().includes("duplicate"));
    return {
      ok: false,
      blocked: duplicateRejected,
      routeId: route.id,
      orderId: route.orderId,
      routingStatus: route.routingStatus,
      deliveryStatus: route.deliveryStatus,
      executionStatus: route.executionStatus,
      blockReason: dispatch.reason,
      message: dispatch.reason ?? "EA Bridge rejected the autonomous strategy signal."
    };
  }

  audit(role, "Autonomous strategy signal routed", route.id, null, { commandUuid: dispatch.commandUuid, channel: channel?.channelUuid }, request);
  return {
    ok: true,
    routeId: route.id,
    orderId: route.orderId,
    bridgeCommandUuid: dispatch.commandUuid,
    routingStatus: route.routingStatus,
    deliveryStatus: route.deliveryStatus,
    executionStatus: route.executionStatus,
    message: "Strategy signal autonomously routed to EA Bridge. NexusBridgeEA will poll and execute when PollApprovedCommands and EnableCommandExecution are enabled."
  };
}

export function ingestStrategySignal(input: StrategySignalInput, role: Mt5Role, confirmed: boolean, request?: Request) {
  authorize(role, "submitSignal");
  confirm(confirmed);
  return ingestStrategySignalInternal(input, role, request);
}

function recordDispatchFeedback(route: OrderRoute, commandUuid: string) {
  state.feedback.unshift({
    id: `feedback-${Date.now()}-${state.feedback.length}`,
    routeId: route.id,
    orderId: route.orderId,
    accountLogin: route.accountLogin,
    brokerName: route.brokerName,
    symbol: route.symbol,
    commandSentAt: new Date().toISOString(),
    requestedPrice: route.entryPrice,
    executionTimeMs: 0,
    mt5ResponseCode: "QUEUED",
    responseMessage: "Trade command queued on EA Bridge; awaiting EA poll.",
    executionStatus: "Pending"
  });
}

function finalizeRouteDispatch(route: OrderRoute, result: { accepted: boolean; reason?: string; command?: { commandUuid: string } }, role: Mt5Role, request?: Request) {
  const now = new Date().toISOString();
  if (!result.accepted || !result.command) {
    route.routingStatus = "Failed";
    route.deliveryStatus = "Blocked";
    route.executionStatus = "Rejected";
    route.failureReason = result.reason ?? "EA Bridge rejected the trade command.";
    route.updatedAt = now;
    addLog(route, "Failed", "Critical", route.failureReason, "Command not queued", "Not delivered");
    audit(role, "EA bridge dispatch rejected", route.id, null, { reason: route.failureReason }, request);
    return { accepted: false, reason: route.failureReason, route };
  }

  route.bridgeCommandUuid = result.command.commandUuid;
  route.routingStatus = "Routed";
  route.deliveryStatus = "Pending";
  route.executionStatus = "Pending";
  route.failureReason = undefined;
  route.updatedAt = now;
  recordDispatchFeedback(route, result.command.commandUuid);
  addLog(route, "Routed", "Info", "Trade command queued on EA Bridge for signed EA poll delivery.", "Queue command", result.command.commandUuid);
  audit(role, "Order route dispatched to EA bridge", route.id, null, { commandUuid: result.command.commandUuid }, request);
  return { accepted: true, route, commandUuid: result.command.commandUuid };
}

export function dispatchRouteToEa(id: string, role: Mt5Role, confirmed: boolean, request?: Request) {
  authorize(role, "dispatch");
  confirm(confirmed);
  if (state.routingPaused || state.emergencyStopActive) {
    throw new Error("Dispatch blocked while order routing is paused or emergency stopped.");
  }

  const route = routeById(id);
  if (route.routingStatus === "Blocked" || route.routingStatus === "Cancelled") {
    throw new Error(`Route ${route.id} cannot be dispatched while ${route.routingStatus.toLowerCase()}.`);
  }
  if (route.executionStatus === "Executed") {
    throw new Error("Executed routes cannot be dispatched again.");
  }

  syncChannelsFromEaBridge();
  autonomousEnsureTradingChannel(route.eaInstanceId, role, request);
  syncChannelsFromEaBridge();

  const validation = validatePreRoute(routeContext(route));
  if (!validation.approved) {
    route.routingStatus = "Blocked";
    route.deliveryStatus = "Blocked";
    route.executionStatus = "Not Sent";
    route.failureReason = validation.reason;
    route.updatedAt = new Date().toISOString();
    addLog(route, "Blocked", "Critical", `Dispatch blocked: ${validation.reason}.`, "Pre-route validation", "Not sent");
    throw new Error(`Dispatch blocked: ${validation.reason}`);
  }

  resolveEaInstanceForDispatch(route.eaInstanceId);
  const command = buildTradeCommandFromRoute(route);
  const result = dispatchTradeCommandToEaBridge({
    command,
    role,
    confirmed: true,
    request,
    enableTradingChannel: true
  });
  return finalizeRouteDispatch(route, result, role, request);
}

export function submitTestOrderToEa(
  input: {
    eaInstanceId: string;
    symbol: string;
    volume: number;
    direction?: "Buy" | "Sell";
    orderType?: "Market" | "Limit";
    entryPrice?: number;
  },
  role: Mt5Role,
  confirmed: boolean,
  request?: Request
) {
  authorize(role, "submitTest");
  confirm(confirmed);

  const result = ingestStrategySignalInternal(
    {
      eaInstanceId: input.eaInstanceId,
      symbol: input.symbol,
      volume: input.volume,
      direction: input.direction ?? "Buy",
      orderType: input.orderType ?? "Market",
      entryPrice: input.entryPrice,
      strategyId: "nexus-test-order",
      strategyName: "Nexus Test Order",
      sourceEngine: "Order Router Manual Test",
      signalId: `SIG-TEST-${Date.now()}`
    },
    role,
    request
  );

  return {
    accepted: result.ok,
    reason: result.blockReason,
    route: result.routeId ? routeById(result.routeId) : undefined,
    commandUuid: result.bridgeCommandUuid,
    message: result.ok
      ? "Test order queued on EA Bridge. Ensure PollApprovedCommands and EnableCommandExecution are enabled in NexusBridgeEA inputs."
      : result.message
  };
}

export function applyBridgeExecutionFeedback(input: {
  commandUuid: string;
  status: "Executed" | "Rejected";
  responseTimeMs: number;
  rejectionReason?: string;
  executedAt?: string;
}) {
  const route = state.routes.find((item) => item.bridgeCommandUuid === input.commandUuid);
  if (!route) return null;

  const now = input.executedAt ?? new Date().toISOString();
  route.deliveryStatus = "Delivered";
  route.executionResponseTimeMs = input.responseTimeMs;
  route.updatedAt = now;

  if (input.status === "Executed") {
    route.routingStatus = "Executed";
    route.executionStatus = "Executed";
    route.failureReason = undefined;
    addLog(route, "Executed", "Info", "MT5 execution feedback confirmed the trade command.", "Execution feedback", "Executed");
  } else {
    route.routingStatus = "Failed";
    route.executionStatus = "Rejected";
    route.failureReason = input.rejectionReason ?? "MT5 rejected the trade command.";
    addLog(route, "Failed", "Warning", route.failureReason, "Execution feedback", "Rejected");
  }

  const feedback = state.feedback.find((item) => item.routeId === route.id);
  if (feedback) {
    feedback.deliveredAt = now;
    feedback.executionTimeMs = input.responseTimeMs;
    feedback.executionStatus = input.status === "Executed" ? "Executed" : "Rejected";
    feedback.responseMessage = input.rejectionReason ?? (input.status === "Executed" ? "MT5 execution confirmed" : "MT5 rejected command");
    feedback.mt5ResponseCode = input.status === "Executed" ? "10009" : "REJECTED";
    if (input.status === "Executed") {
      feedback.executedAt = now;
      if (feedback.executedPrice == null && route.entryPrice > 0) feedback.executedPrice = route.entryPrice;
    }
  }

  if (input.status === "Executed") {
    ingestExecutionFromOrderRouter({
      routeId: route.id,
      orderId: route.orderId,
      accountId: route.accountId,
      accountLogin: route.accountLogin,
      brokerId: route.brokerId,
      brokerName: route.brokerName,
      terminalId: route.terminalId,
      terminalName: route.terminalName,
      eaInstanceId: route.eaInstanceId,
      eaInstanceName: route.eaInstanceName,
      strategyId: route.strategyId,
      strategyName: route.strategyName,
      symbol: route.symbol,
      normalizedSymbol: route.normalizedSymbol,
      direction: route.direction,
      orderType: route.orderType,
      requestedPrice: feedback?.requestedPrice ?? route.entryPrice,
      executedPrice: feedback?.executedPrice ?? route.entryPrice,
      executionTimeMs: input.responseTimeMs,
      executedAt: now,
      mt5Ticket: route.mt5Ticket
    });
  }

  return route;
}

export function buildOrderRouterResponse(role: Mt5Role = "Infrastructure Admin"): RouterResponse {
  syncChannelsFromEaBridge();
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
      { label: "Highest Risk Route", value: highestRisk?.id ?? "None", status: "Critical", detail: highestRisk?.failureReason ?? "Monitor", updatedAt: now }
    ],
    health,
    workflow: titles.map((title, index) => ({
      title,
      status: failures && index >= 1 ? index >= 6 ? "Critical" : "Degraded" : "Healthy",
      orderCount: state.routes.length - (index ? failures : 0),
      failureCount: index ? failures : 0,
      averageDelayMs: avg((route) => route.routingLatencyMs),
      lastProcessedOrder: state.routes[0]?.orderId ?? "None",
      aiRecommendation: title === "Duplicate Check" ? "Retain block for any equivalent executed order." : title === "EA Bridge Delivery" ? "Favor the lowest-latency healthy channel for retries." : undefined
    })),
    routes: state.routes, channels: state.channels, blockedOrders: state.blockedOrders, feedback: state.feedback, logs: state.logs, diagnostics: state.diagnostics, audits: state.audits,
    permissions: {
      role, canSync: permissions.sync.includes(role), canDiagnostics: permissions.diagnostics.includes(role), canPauseResume: permissions.pauseResume.includes(role), canEmergencyStop: permissions.emergencyStop.includes(role), canRetry: permissions.retry.includes(role), canCancel: permissions.cancel.includes(role), canRevalidate: permissions.revalidate.includes(role), canReviewBlocked: permissions.reviewBlocked.includes(role), canAutoRemediate: permissions.autoRemediate.includes(role), canDispatch: permissions.dispatch.includes(role), canSubmitTest: permissions.submitTest.includes(role), canSubmitSignal: permissions.submitSignal.includes(role)
    }
  };
}
export function routerSummary(role: Mt5Role) {
  const response = buildOrderRouterResponse(role);
  return { meta: response.meta, kpis: response.kpis, health: response.health, workflow: response.workflow, permissions: response.permissions };
}

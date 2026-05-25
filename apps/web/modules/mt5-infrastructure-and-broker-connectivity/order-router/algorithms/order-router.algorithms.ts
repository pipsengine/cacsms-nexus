import type { OrderRoute, RouterHealth, RoutingChannel } from "../types/order-router.types";

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));
const rating = (score: number): RouterHealth["rating"] =>
  score >= 90 ? "Excellent" : score >= 75 ? "Healthy" : score >= 60 ? "Degraded" : score >= 40 ? "High Risk" : "Critical";

export function calculateRoutingHealth(routes: OrderRoute[], channels: RoutingChannel[]): RouterHealth {
  const total = routes.length || 1;
  const pass = (key: keyof OrderRoute) => routes.filter((route) => route[key] === "Passed").length / total;
  const successfulDelivery = routes.filter((route) => route.deliveryStatus === "Delivered").length / total;
  const feedback = routes.filter((route) => route.executionStatus === "Executed" || route.executionStatus === "Rejected").length / total;
  const failureCount = routes.filter((route) => route.routingStatus === "Failed" || route.routingStatus === "Blocked").length;
  const latency = routes.reduce((sum, route) => sum + route.routingLatencyMs, 0) / total;
  const channelPenalty = channels.filter((channel) => channel.riskLevel === "Critical").length * 4;
  const factors = {
    signalValidationScore: pass("signalValidationStatus") * 16,
    riskValidationScore: pass("riskStatus") * 18,
    accountReadinessScore: pass("accountReadinessStatus") * 14,
    brokerReadinessScore: pass("brokerReadinessStatus") * 14,
    bridgeDeliveryScore: successfulDelivery * 18,
    executionFeedbackScore: feedback * 20,
    failurePenalty: failureCount * -5,
    latencyPenalty: latency > 400 ? -12 : latency > 200 ? -7 : latency > 100 ? -3 : 0,
    channelPenalty: -channelPenalty
  };
  const score = clamp(Object.values(factors).reduce((sum, factor) => sum + factor, 0));
  return { score, rating: rating(score), factors };
}

export type PreRouteContext = {
  signalApproved: boolean;
  strategyActive: boolean;
  accountSynced: boolean;
  accountTradingEnabled: boolean;
  brokerExecutionEnabled: boolean;
  terminalOnline: boolean;
  eaBridgeActive: boolean;
  symbolMapped: boolean;
  spreadAcceptable: boolean;
  marginSufficient: boolean;
  newsBlackoutClear: boolean;
  duplicateClear: boolean;
  riskApproved: boolean;
  emergencyStopActive: boolean;
};

export function validatePreRoute(context: PreRouteContext) {
  const checks: Array<[keyof PreRouteContext, string]> = [
    ["signalApproved", "Signal is not approved"],
    ["strategyActive", "Strategy is inactive"],
    ["accountSynced", "Account not ready"],
    ["accountTradingEnabled", "Trading disabled"],
    ["brokerExecutionEnabled", "Broker degraded"],
    ["terminalOnline", "Terminal offline"],
    ["eaBridgeActive", "EA channel unavailable"],
    ["symbolMapped", "Symbol not mapped"],
    ["spreadAcceptable", "Spread too wide"],
    ["marginSufficient", "Margin insufficient"],
    ["newsBlackoutClear", "News blackout window"],
    ["duplicateClear", "Duplicate order"],
    ["riskApproved", "Risk limit exceeded"]
  ];
  if (context.emergencyStopActive) return { approved: false, reason: "Emergency stop active" };
  const failed = checks.find(([key]) => !context[key]);
  return failed ? { approved: false, reason: failed[1] } : { approved: true, reason: "All pre-route safety gates passed." };
}

export function duplicateProtection(candidate: OrderRoute, existing: OrderRoute[], timestampWindowMs = 30_000) {
  const match = existing.find((route) => route.id !== candidate.id &&
    route.signalId === candidate.signalId &&
    route.strategyId === candidate.strategyId &&
    route.accountId === candidate.accountId &&
    route.symbol === candidate.symbol &&
    route.direction === candidate.direction &&
    route.orderType === candidate.orderType &&
    route.volume === candidate.volume &&
    route.entryPrice === candidate.entryPrice &&
    Math.abs(new Date(candidate.createdAt).getTime() - new Date(route.createdAt).getTime()) <= timestampWindowMs);
  return match ? { result: "Confirmed duplicate" as const, blocked: true, matchedRouteId: match.id } :
    { result: "Unique" as const, blocked: false, matchedRouteId: undefined };
}

export function evaluateRetrySafety(route: OrderRoute, input: {
  feedbackConfirmsFailure: boolean;
  duplicateClear: boolean;
  priceWithinTolerance: boolean;
  riskRevalidated: boolean;
  targetHealthy: boolean;
}) {
  const failures: string[] = [];
  if (route.executionStatus === "Executed") failures.push("Original order was already executed");
  if (route.mt5Ticket) failures.push("MT5 ticket already exists");
  if (!input.feedbackConfirmsFailure) failures.push("Execution failure has not been confirmed");
  if (!input.duplicateClear) failures.push("Duplicate execution risk is present");
  if (!input.priceWithinTolerance) failures.push("Market price moved beyond tolerance");
  if (!input.riskRevalidated) failures.push("Risk engine has not revalidated the order");
  if (!input.targetHealthy) failures.push("Target account, broker, terminal, or channel is unhealthy");
  return { safe: failures.length === 0, failures };
}

export function selectSmartRoute(channels: RoutingChannel[]) {
  const score = (channel: RoutingChannel) =>
    (channel.tradingEnabled ? 40 : -100) + channel.commandSuccessRate * 0.4 - channel.messageLatencyMs * 0.08 -
    channel.queueBacklogCount * 3 - (channel.riskLevel === "Critical" ? 80 : channel.riskLevel === "Degraded" ? 25 : 0);
  const ranked = [...channels].sort((left, right) => score(right) - score(left));
  return {
    primaryRoute: ranked[0],
    backupRoute: ranked.find((channel, index) => index > 0 && channel.tradingEnabled && channel.riskLevel !== "Critical"),
    unsafeRoutes: ranked.filter((channel) => !channel.tradingEnabled || channel.riskLevel === "Critical"),
    reason: ranked[0] ? `${ranked[0].brokerName} selected using readiness, latency, backlog, and command reliability scoring.` : "No routing channel available."
  };
}

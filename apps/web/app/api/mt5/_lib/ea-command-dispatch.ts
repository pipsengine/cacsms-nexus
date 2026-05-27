import "server-only";

import type { Mt5Role } from "@/modules/mt5-infrastructure-and-broker-connectivity/mt5-control-center/types/mt5-control-center.types";
import type { EaInstance, TradeCommand } from "@/modules/mt5-infrastructure-and-broker-connectivity/ea-bridge/types/ea-bridge.types";
import type { OrderRoute, StrategySignalInput } from "@/modules/mt5-infrastructure-and-broker-connectivity/order-router/types/order-router.types";

import { bridgeInstance, queueTradeCommand, setBridgeTrading } from "../ea-bridge/_lib/store";

export function createCommandUuid() {
  return `cmd-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function mapOrderTypeToCommandType(orderType: OrderRoute["orderType"]): TradeCommand["commandType"] {
  if (orderType === "Limit") return "Limit";
  return "Market";
}

export function buildTradeCommandFromRoute(route: OrderRoute, commandUuid = createCommandUuid()): TradeCommand {
  const now = new Date().toISOString();
  return {
    id: `ea-cmd-${commandUuid}`,
    commandUuid,
    eaInstanceId: route.eaInstanceId,
    accountId: route.accountId,
    accountLogin: route.accountLogin,
    symbol: route.symbol,
    commandType: mapOrderTypeToCommandType(route.orderType),
    direction: route.direction,
    volume: route.volume,
    requestedPrice: route.entryPrice,
    stopLoss: route.stopLoss > 0 ? route.stopLoss : undefined,
    takeProfit: route.takeProfit > 0 ? route.takeProfit : undefined,
    riskApprovalStatus: "Approved",
    deliveryStatus: "Pending",
    executionStatus: "Pending",
    responseTimeMs: 0,
    rejectionReason: undefined,
    signalTimestamp: now,
    strategyId: route.strategyId,
    createdAt: now,
    executedAt: undefined
  };
}

export function buildStrategySignalRoute(input: {
  signal: StrategySignalInput;
  eaInstance: EaInstance;
  signalId: string;
  orderId: string;
}): OrderRoute {
  const now = new Date().toISOString();
  const orderType = input.signal.orderType ?? "Market";
  const symbol = input.signal.symbol.trim();
  return {
    id: `route-sig-${Date.now()}`,
    routeUuid: `route-uuid-sig-${Date.now()}`,
    orderId: input.orderId,
    signalId: input.signalId,
    strategyId: input.signal.strategyId ?? "strategy-autonomous",
    strategyName: input.signal.strategyName ?? "Autonomous Strategy Signal",
    sourceEngine: input.signal.sourceEngine ?? "Strategy Orchestrator",
    accountId: input.eaInstance.accountId,
    accountLogin: input.eaInstance.accountLogin,
    brokerId: input.eaInstance.brokerId ?? "broker-local",
    brokerName: input.eaInstance.brokerName,
    mt5Server: input.eaInstance.brokerName,
    terminalId: input.eaInstance.terminalId,
    terminalName: input.eaInstance.terminalName,
    eaInstanceId: input.eaInstance.id,
    eaInstanceName: input.eaInstance.eaName,
    executionChannel: "HTTPS Bridge",
    symbol,
    normalizedSymbol: symbol,
    brokerSymbol: symbol,
    direction: input.signal.direction,
    orderType,
    volume: input.signal.volume,
    entryPrice: input.signal.entryPrice ?? 0,
    stopLoss: input.signal.stopLoss ?? 0,
    takeProfit: input.signal.takeProfit ?? 0,
    timeInForce: "IOC",
    requestedExecutionTime: now,
    routingPriority: input.signal.routingPriority ?? "Normal",
    fallbackRouteAvailable: false,
    signalValidationStatus: "Passed",
    riskStatus: "Passed",
    accountReadinessStatus: "Passed",
    brokerReadinessStatus: "Passed",
    symbolMappingStatus: "Passed",
    duplicateCheckStatus: "Passed",
    marginCheckStatus: "Passed",
    marketConditionStatus: "Passed",
    routingStatus: "Pending",
    deliveryStatus: "Pending",
    executionStatus: "Pending",
    routingLatencyMs: 0,
    executionResponseTimeMs: 0,
    createdAt: now,
    updatedAt: now
  };
}

export function buildTestOrderRoute(input: {
  eaInstance: EaInstance;
  symbol: string;
  volume: number;
  direction?: "Buy" | "Sell";
  orderType?: "Market" | "Limit";
  entryPrice?: number;
}): OrderRoute {
  const now = new Date().toISOString();
  const orderId = `ORD-TEST-${Date.now()}`;
  const orderType = input.orderType ?? "Market";
  return {
    id: `route-test-${Date.now()}`,
    routeUuid: `route-uuid-test-${Date.now()}`,
    orderId,
    signalId: `SIG-TEST-${Date.now()}`,
    strategyId: "nexus-test-order",
    strategyName: "Nexus Test Order",
    sourceEngine: "EA Terminal Hub",
    accountId: input.eaInstance.accountId,
    accountLogin: input.eaInstance.accountLogin,
    brokerId: input.eaInstance.brokerId ?? "broker-local",
    brokerName: input.eaInstance.brokerName,
    mt5Server: input.eaInstance.brokerName,
    terminalId: input.eaInstance.terminalId,
    terminalName: input.eaInstance.terminalName,
    eaInstanceId: input.eaInstance.id,
    eaInstanceName: input.eaInstance.eaName,
    executionChannel: "HTTPS Bridge",
    symbol: input.symbol,
    normalizedSymbol: input.symbol,
    brokerSymbol: input.symbol,
    direction: input.direction ?? "Buy",
    orderType,
    volume: input.volume,
    entryPrice: input.entryPrice ?? 0,
    stopLoss: 0,
    takeProfit: 0,
    timeInForce: "IOC",
    requestedExecutionTime: now,
    routingPriority: "Normal",
    fallbackRouteAvailable: false,
    signalValidationStatus: "Passed",
    riskStatus: "Passed",
    accountReadinessStatus: "Passed",
    brokerReadinessStatus: "Passed",
    symbolMappingStatus: "Passed",
    duplicateCheckStatus: "Passed",
    marginCheckStatus: "Passed",
    marketConditionStatus: "Passed",
    routingStatus: "Pending",
    deliveryStatus: "Pending",
    executionStatus: "Pending",
    routingLatencyMs: 0,
    executionResponseTimeMs: 0,
    createdAt: now,
    updatedAt: now
  };
}

export function dispatchTradeCommandToEaBridge(input: {
  command: TradeCommand;
  role: Mt5Role;
  confirmed: boolean;
  request?: Request;
  enableTradingChannel?: boolean;
}) {
  if (input.enableTradingChannel) {
    setBridgeTrading(input.command.eaInstanceId, true, input.role, true, input.request);
  }
  return queueTradeCommand(input.command, input.role, input.confirmed, input.request);
}

export function resolveEaInstanceForDispatch(eaInstanceId: string) {
  return bridgeInstance(eaInstanceId);
}

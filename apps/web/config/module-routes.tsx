import type { ComponentType } from "react";

import { AccountSyncDashboard } from "@/modules/mt5-infrastructure-and-broker-connectivity/account-sync/components/account-sync-dashboard";
import { BrokerConnectionsDashboard } from "@/modules/mt5-infrastructure-and-broker-connectivity/broker-connections/components/broker-connections-dashboard";
import { ChartControlDashboard } from "@/modules/mt5-infrastructure-and-broker-connectivity/chart-control/components/chart-control-dashboard";
import { ChartTemplatesDashboard } from "@/modules/mt5-infrastructure-and-broker-connectivity/chart-templates/components/chart-templates-dashboard";
import { ConnectionHealthDashboard } from "@/modules/mt5-infrastructure-and-broker-connectivity/connection-health/components/connection-health-dashboard";
import { EaBridgeDashboard } from "@/modules/mt5-infrastructure-and-broker-connectivity/ea-bridge/components/ea-bridge-dashboard";
import { EaMonitoringDashboard } from "@/modules/mt5-infrastructure-and-broker-connectivity/ea-monitoring/components/ea-monitoring-dashboard";
import { EaTerminalHubDashboard } from "@/modules/mt5-infrastructure-and-broker-connectivity/ea-terminal-hub/components/ea-terminal-hub-dashboard";
import { ExecutionLogsDashboard } from "@/modules/mt5-infrastructure-and-broker-connectivity/execution-logs/components/execution-logs-dashboard";
import { ExecutionQueueDashboard } from "@/modules/mt5-infrastructure-and-broker-connectivity/execution-queue/components/execution-queue-dashboard";
import { LatencyMonitorDashboard } from "@/modules/mt5-infrastructure-and-broker-connectivity/latency-monitor/components/latency-monitor-dashboard";
import { MarketWatchDashboard } from "@/modules/mt5-infrastructure-and-broker-connectivity/market-watch/components/market-watch-dashboard";
import { Mt5ControlCenterDashboard } from "@/modules/mt5-infrastructure-and-broker-connectivity/mt5-control-center/components/mt5-control-center-dashboard";
import { Mt5ErrorLogsDashboard } from "@/modules/mt5-infrastructure-and-broker-connectivity/mt5-error-logs/components/mt5-error-logs-dashboard";
import { OrderRouterDashboard } from "@/modules/mt5-infrastructure-and-broker-connectivity/order-router/components/order-router-dashboard";
import { SlippageMonitorDashboard } from "@/modules/mt5-infrastructure-and-broker-connectivity/slippage-monitor/components/slippage-monitor-dashboard";
import { SpreadMonitorDashboard } from "@/modules/mt5-infrastructure-and-broker-connectivity/spread-monitor/components/spread-monitor-dashboard";
import { SymbolSyncDashboard } from "@/modules/mt5-infrastructure-and-broker-connectivity/symbol-sync/components/symbol-sync-dashboard";
import { TerminalStatusDashboard } from "@/modules/mt5-infrastructure-and-broker-connectivity/terminal-status/components/terminal-status-dashboard";
import { TradeSynchronizationDashboard } from "@/modules/mt5-infrastructure-and-broker-connectivity/trade-synchronization/components/trade-synchronization-dashboard";

/** Canonical paths for implemented module dashboards. */
export const implementedModulePages: Record<string, ComponentType> = {
  "/mt5-infrastructure-and-broker-connectivity/mt5-control-center": Mt5ControlCenterDashboard,
  "/mt5-infrastructure-and-broker-connectivity/terminal-status": TerminalStatusDashboard,
  "/mt5-infrastructure-and-broker-connectivity/ea-bridge": EaBridgeDashboard,
  "/mt5-infrastructure-and-broker-connectivity/ea-terminal-hub": EaTerminalHubDashboard,
  "/mt5-infrastructure-and-broker-connectivity/broker-connections": BrokerConnectionsDashboard,
  "/mt5-infrastructure-and-broker-connectivity/account-sync": AccountSyncDashboard,
  "/mt5-infrastructure-and-broker-connectivity/symbol-sync": SymbolSyncDashboard,
  "/mt5-infrastructure-and-broker-connectivity/market-watch": MarketWatchDashboard,
  "/mt5-infrastructure-and-broker-connectivity/chart-control": ChartControlDashboard,
  "/mt5-infrastructure-and-broker-connectivity/chart-templates": ChartTemplatesDashboard,
  "/mt5-infrastructure-and-broker-connectivity/order-router": OrderRouterDashboard,
  "/mt5-infrastructure-and-broker-connectivity/trade-synchronization": TradeSynchronizationDashboard,
  "/mt5-infrastructure-and-broker-connectivity/execution-queue": ExecutionQueueDashboard,
  "/mt5-infrastructure-and-broker-connectivity/execution-logs": ExecutionLogsDashboard,
  "/mt5-infrastructure-and-broker-connectivity/connection-health": ConnectionHealthDashboard,
  "/mt5-infrastructure-and-broker-connectivity/latency-monitor": LatencyMonitorDashboard,
  "/mt5-infrastructure-and-broker-connectivity/spread-monitor": SpreadMonitorDashboard,
  "/mt5-infrastructure-and-broker-connectivity/slippage-monitor": SlippageMonitorDashboard,
  "/mt5-infrastructure-and-broker-connectivity/mt5-error-logs": Mt5ErrorLogsDashboard,
  "/mt5-infrastructure-and-broker-connectivity/ea-monitoring": EaMonitoringDashboard
};

/** Legacy or alias paths that should resolve to a canonical implemented route. */
export const modulePathAliases: Record<string, string> = {
  "/mt5-infrastructure-and-broker-connectivity/ea-and-terminal-hub": "/mt5-infrastructure-and-broker-connectivity/ea-terminal-hub"
};

export function resolveImplementedModulePage(pathname: string) {
  const normalized = pathname.split("?")[0].split("#")[0];
  const canonical = modulePathAliases[normalized] ?? normalized;
  return implementedModulePages[canonical] ?? null;
}

export function resolveCanonicalModulePath(pathname: string) {
  const normalized = pathname.split("?")[0].split("#")[0];
  return modulePathAliases[normalized] ?? normalized;
}

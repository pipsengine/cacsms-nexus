import { resetAccountSyncState } from "@/app/api/mt5/account-sync/_lib/store";
import { resetBrokerConnectionsState } from "@/app/api/mt5/broker-connections/_lib/store";
import { resetChartControlState } from "@/app/api/mt5/chart-control/_lib/store";
import { resetChartTemplatesState } from "@/app/api/mt5/chart-templates/_lib/store";
import { resetConnectionHealthState } from "@/app/api/mt5/connection-health/_lib/store";
import { resetEaBridgeState } from "@/app/api/mt5/ea-bridge/_lib/store";
import { resetEaMonitoringState } from "@/app/api/mt5/ea-monitoring/_lib/store";
import { resetEaTerminalHubState } from "@/app/api/mt5/ea-terminal-hub/_lib/store";
import { resetErrorLogsState } from "@/app/api/mt5/error-logs/_lib/store";
import { resetExecutionLogsState } from "@/app/api/mt5/execution-logs/_lib/store";
import { resetExecutionQueueState } from "@/app/api/mt5/execution-queue/_lib/store";
import { resetLatencyMonitorState } from "@/app/api/mt5/latency-monitor/_lib/store";
import { resetMarketWatchState } from "@/app/api/mt5/market-watch/_lib/store";
import { resetMt5ControlCenterState } from "@/app/api/mt5/_lib/store";
import { resetOrderRouterState } from "@/app/api/mt5/order-router/_lib/store";
import { resetSlippageMonitorState } from "@/app/api/mt5/slippage-monitor/_lib/store";
import { resetSpreadMonitorState } from "@/app/api/mt5/spread-monitor/_lib/store";
import { resetSymbolSyncState } from "@/app/api/mt5/symbol-sync/_lib/store";
import { resetTerminalStatusState } from "@/app/api/mt5/terminal-status/_lib/store";
import { resetTradeSyncState } from "@/app/api/mt5/trade-synchronization/store";
import { createAccountSyncSeed } from "@/tests/fixtures/account-sync.fixture";
import { createBrokerConnectionsSeed } from "@/tests/fixtures/broker-connections.fixture";
import { createChartControlSeed } from "@/tests/fixtures/chart-control.fixture";
import { createChartTemplatesSeed } from "@/tests/fixtures/chart-templates.fixture";
import { createConnectionHealthSeed } from "@/tests/fixtures/connection-health.fixture";
import { createEaBridgeSeed } from "@/tests/fixtures/ea-bridge.fixture";
import { createEaMonitoringSeed } from "@/tests/fixtures/ea-monitoring.fixture";
import { createEaTerminalHubSeed } from "@/tests/fixtures/ea-terminal-hub.fixture";
import { createExecutionLogsSeed } from "@/tests/fixtures/execution-logs.fixture";
import { createExecutionQueueSeed } from "@/tests/fixtures/execution-queue.fixture";
import { createLatencyMonitorSeed } from "@/tests/fixtures/latency-monitor.fixture";
import { createMarketWatchSeed } from "@/tests/fixtures/market-watch.fixture";
import { createMt5Seed } from "@/tests/fixtures/mt5-control-center.fixture";
import { createMt5ErrorLogsSeed } from "@/tests/fixtures/mt5-error-logs.fixture";
import { createOrderRouterSeed } from "@/tests/fixtures/order-router.fixture";
import { createSlippageMonitorSeed } from "@/tests/fixtures/slippage-monitor.fixture";
import { createSpreadMonitorSeed } from "@/tests/fixtures/spread-monitor.fixture";
import { createSymbolSyncSeed } from "@/tests/fixtures/symbol-sync.fixture";
import { createTerminalStatusSeed } from "@/tests/fixtures/terminal-status.fixture";
import { getMockLogs, getMockTrades } from "@/tests/fixtures/trade-synchronization.fixture";

export function seedAccountSyncStore() {
  resetAccountSyncState(createAccountSyncSeed());
}

export function seedBrokerConnectionsStore() {
  resetBrokerConnectionsState(createBrokerConnectionsSeed());
}

export function seedChartControlStore() {
  resetChartControlState(createChartControlSeed());
}

export function seedChartTemplatesStore() {
  resetChartTemplatesState(createChartTemplatesSeed());
}

export function seedConnectionHealthStore() {
  resetConnectionHealthState(createConnectionHealthSeed());
}

export function seedEaBridgeStore() {
  resetEaBridgeState(createEaBridgeSeed());
}

export function seedEaMonitoringStore() {
  resetEaMonitoringState(createEaMonitoringSeed());
}

export function seedEaTerminalHubStore() {
  resetEaTerminalHubState(createEaTerminalHubSeed());
}

export function seedErrorLogsStore() {
  resetErrorLogsState(createMt5ErrorLogsSeed());
}

export function seedExecutionLogsStore() {
  resetExecutionLogsState(createExecutionLogsSeed());
}

export function seedExecutionQueueStore() {
  resetExecutionQueueState(createExecutionQueueSeed());
}

export function seedLatencyMonitorStore() {
  resetLatencyMonitorState(createLatencyMonitorSeed());
}

export function seedMarketWatchStore() {
  resetMarketWatchState(createMarketWatchSeed());
}

export function seedMt5ControlCenterStore() {
  resetMt5ControlCenterState(createMt5Seed());
}

export function seedOrderRouterStore() {
  resetOrderRouterState(createOrderRouterSeed());
}

export function seedSlippageMonitorStore() {
  resetSlippageMonitorState(createSlippageMonitorSeed());
}

export function seedSpreadMonitorStore() {
  resetSpreadMonitorState(createSpreadMonitorSeed());
}

export function seedSymbolSyncStore() {
  resetSymbolSyncState(createSymbolSyncSeed());
}

export function seedTerminalStatusStore() {
  resetTerminalStatusState(createTerminalStatusSeed());
}

export function seedTradeSyncStore() {
  resetTradeSyncState({ trades: getMockTrades(), logs: getMockLogs() });
}

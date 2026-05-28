import { mapToOperatorDashboardResponse } from "@/modules/autonomous-computer-operator/operator-dashboard/algorithms/operator-dashboard.algorithms";
import type { OperatorDashboardResponse } from "@/modules/autonomous-computer-operator/operator-dashboard/types/operator-dashboard.types";
import type { Mt5Role } from "@/modules/mt5-infrastructure-and-broker-connectivity/mt5-control-center/types/mt5-control-center.types";
import { resolveMt5Role } from "../../../mt5/_lib/access";
import { withEaBridgeStore } from "../../../mt5/ea-bridge/_lib/handler";

export function operatorDashboardRole(request?: Request): Mt5Role {
  return resolveMt5Role(request);
}

async function loadOperatorTelemetry(role: Mt5Role) {
  const [
    { buildTerminalStatusResponse },
    { buildEaBridgeResponse },
    { buildSummary: buildConnectionSummary, listComponents, connectionHealthUnsafeTradingDisabled },
    { buildOrderRouterResponse },
    { buildSummary: buildExecutionQueueSummary }
  ] = await Promise.all([
    import("../../../mt5/terminal-status/_lib/store"),
    import("../../../mt5/ea-bridge/_lib/store"),
    import("../../../mt5/connection-health/_lib/store"),
    import("../../../mt5/order-router/_lib/store"),
    import("../../../mt5/execution-queue/_lib/store")
  ]);

  const [terminalStatus, eaBridge, connectionSummary, orderRouter, executionQueue] = await Promise.all([
    Promise.resolve(buildTerminalStatusResponse(role)),
    withEaBridgeStore(() => buildEaBridgeResponse(role)),
    Promise.resolve(buildConnectionSummary(role)),
    Promise.resolve(buildOrderRouterResponse(role)),
    Promise.resolve(buildExecutionQueueSummary(role))
  ]);

  const connectionComponents = listComponents({ pageSize: 120 }).components;

  return {
    terminalStatus,
    eaBridge,
    connectionSummary,
    orderRouter,
    executionQueue,
    unsafeTradingDisabled: connectionHealthUnsafeTradingDisabled(),
    connectionComponents
  };
}

export async function buildOperatorDashboardResponse(
  role: Mt5Role = operatorDashboardRole(),
  highlightedHost: string | null = null
): Promise<OperatorDashboardResponse> {
  const bundle = await loadOperatorTelemetry(role);
  const highlight =
    highlightedHost && bundle.terminalStatus.terminals.some((terminal) => terminal.hostMachine === highlightedHost)
      ? highlightedHost
      : null;

  return mapToOperatorDashboardResponse({ bundle, role, highlightedHost: highlight });
}

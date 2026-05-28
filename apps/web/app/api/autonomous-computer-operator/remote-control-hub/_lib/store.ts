import { mapToRemoteControlHubResponse } from "@/modules/autonomous-computer-operator/remote-control-hub/algorithms/remote-control-hub.algorithms";
import type { RemoteControlHubResponse } from "@/modules/autonomous-computer-operator/remote-control-hub/types/remote-control-hub.types";
import type { Mt5Role } from "@/modules/mt5-infrastructure-and-broker-connectivity/mt5-control-center/types/mt5-control-center.types";
import { resolveMt5Role } from "../../../mt5/_lib/access";
import { withEaBridgeStore } from "../../../mt5/ea-bridge/_lib/handler";

export function remoteControlHubRole(request?: Request): Mt5Role {
  return resolveMt5Role(request);
}

async function loadRemoteControlTelemetry(role: Mt5Role) {
  const [{ buildTerminalStatusResponse }, { buildEaBridgeResponse }, { buildSummary: buildConnectionSummary, listComponents }] = await Promise.all([
    import("../../../mt5/terminal-status/_lib/store"),
    import("../../../mt5/ea-bridge/_lib/store"),
    import("../../../mt5/connection-health/_lib/store")
  ]);

  const [terminalStatus, eaBridge, connectionSummary] = await Promise.all([
    Promise.resolve(buildTerminalStatusResponse(role)),
    withEaBridgeStore(() => buildEaBridgeResponse(role)),
    Promise.resolve(buildConnectionSummary(role))
  ]);

  const hostComponents = listComponents({ pageSize: 120, type: "Host Machine" }).components;

  return { terminalStatus, eaBridge, connectionSummary, hostComponents };
}

export async function buildRemoteControlHubResponse(
  role: Mt5Role = remoteControlHubRole(),
  highlightedHost: string | null = null
): Promise<RemoteControlHubResponse> {
  const bundle = await loadRemoteControlTelemetry(role);
  const highlight =
    highlightedHost && bundle.terminalStatus.terminals.some((terminal) => terminal.hostMachine === highlightedHost)
      ? highlightedHost
      : null;

  return mapToRemoteControlHubResponse({ bundle, role, highlightedHost: highlight });
}

import { createTerminalStatusSeed } from "@/tests/fixtures/terminal-status.fixture";
import type { Mt5TerminalLink } from "@/modules/mt5-infrastructure-and-broker-connectivity/ea-terminal-hub/types/ea-terminal-hub.types";

const DEFAULT_CACSMS_EA_ROOT = "C:\\Next-Generation\\cacsms-nexus\\services\\cacsms-ea";

function deriveMt5ExpertsPath(terminalExecutablePath: string) {
  const terminalDir = terminalExecutablePath.replace(/\\terminal64\.exe$/i, "");
  return `${terminalDir}\\MQL5\\Experts`;
}

function deriveMt5DataRoot(terminalExecutablePath: string) {
  return terminalExecutablePath.replace(/\\terminal64\.exe$/i, "");
}

export function createEaTerminalHubSeed() {
  const cacsmsEaRoot = DEFAULT_CACSMS_EA_ROOT;
  const terminals: Mt5TerminalLink[] = createTerminalStatusSeed().terminals.map((terminal, index) => {
    const mt5ExpertsPath = deriveMt5ExpertsPath(terminal.terminalPath);
    const mt5DataRoot = deriveMt5DataRoot(terminal.terminalPath);
    const connected = index < 2;
    return {
      terminalId: terminal.terminalId,
      terminalName: terminal.terminalName,
      brokerName: terminal.brokerName,
      accountLogin: terminal.accountLogin,
      hostMachine: terminal.hostMachine,
      region: terminal.region,
      terminalExecutablePath: terminal.terminalPath,
      mt5DataRoot,
      mt5ExpertsPath,
      connectionStatus: connected ? "Connected" : "Disconnected",
      linkStatus: connected ? (index === 0 ? "Linked" : "Drifted") : "Not Linked",
      cacsmsEaRoot,
      linkedAt: connected ? new Date(Date.now() - index * 86_400_000).toISOString() : null,
      lastConnectedAt: connected ? new Date(Date.now() - index * 120_000).toISOString() : null,
      lastSyncAt: connected ? new Date(Date.now() - index * 300_000).toISOString() : null,
      lastHeartbeatAt: terminal.lastHeartbeatAt,
      healthScore: terminal.healthScore,
      riskLevel: terminal.riskLevel,
      autoLinkOnConnect: true,
      isActive: index === 0,
      driftFileCount: index === 1 ? 2 : 0,
      missingInMt5Count: index === 1 ? 1 : 0,
      missingInSystemCount: index === 1 ? 1 : 0,
      bridgeChannelId: connected ? `bridge-${terminal.terminalId}` : null,
      notes: null
    } satisfies Mt5TerminalLink;
  });

  return { terminals, activeTerminalId: terminals.find((t) => t.isActive)?.terminalId ?? null };
}

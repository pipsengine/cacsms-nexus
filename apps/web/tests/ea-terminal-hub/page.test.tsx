import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { EaTerminalHubDashboard } from "@/modules/mt5-infrastructure-and-broker-connectivity/ea-terminal-hub/components/ea-terminal-hub-dashboard";

vi.mock("@/modules/mt5-infrastructure-and-broker-connectivity/ea-terminal-hub/hooks/use-ea-terminal-hub", () => ({
  useEaTerminalHub: () => ({
    data: {
      meta: { timestamp: new Date().toISOString(), currentRole: "Infrastructure Admin", streamEndpoint: "/api/mt5/ea-terminal-hub/events-stream" },
      summary: {
        cacsmsEaRoot: "C:\\Next-Generation\\cacsms-nexus\\services\\cacsms-ea",
        systemFolder: { root: "C:\\Next-Generation\\cacsms-nexus\\services\\cacsms-ea", expertsPath: "C:\\Next-Generation\\cacsms-nexus\\services\\cacsms-ea\\Experts", exists: true, files: [], fileCount: 0, lastScannedAt: new Date().toISOString(), lastModifiedAt: null },
        totalTerminals: 2,
        connectedTerminals: 1,
        linkedTerminals: 1,
        driftedTerminals: 0,
        activeTerminalId: "term-ld4-01",
        linkHealthScore: 88,
        lastUpdatedAt: new Date().toISOString()
      },
      terminals: [
        {
          terminalId: "term-ld4-01",
          terminalName: "MT5-Live-01",
          brokerName: "IC Markets",
          accountLogin: "73018421",
          hostMachine: "VPS-LD4-01",
          region: "London",
          terminalExecutablePath: "C:\\MT5\\Live01\\terminal64.exe",
          mt5DataRoot: "C:\\MT5\\Live01",
          mt5ExpertsPath: "C:\\MT5\\Live01\\MQL5\\Experts",
          connectionStatus: "Connected",
          linkStatus: "Linked",
          cacsmsEaRoot: "C:\\Next-Generation\\cacsms-nexus\\services\\cacsms-ea",
          linkedAt: new Date().toISOString(),
          lastConnectedAt: new Date().toISOString(),
          lastSyncAt: new Date().toISOString(),
          lastHeartbeatAt: new Date().toISOString(),
          healthScore: 96,
          riskLevel: "Healthy",
          autoLinkOnConnect: true,
          isActive: true,
          driftFileCount: 0,
          missingInMt5Count: 0,
          missingInSystemCount: 0,
          bridgeChannelId: "bridge-term-ld4-01",
          notes: null
        }
      ],
      drift: [],
      workflow: [{ step: "Scan Cacsms EA folder", status: "Complete", detail: "ok" }],
      audits: []
    },
    isLoading: false,
    isError: false,
    streamConnected: true,
    action: { mutate: vi.fn(), isPending: false }
  })
}));

describe("EA Terminal Hub dashboard", () => {
  it("renders folder link and multi-terminal sections", () => {
    render(<EaTerminalHubDashboard />);
    expect(screen.getByRole("heading", { name: /EA & Terminal Hub/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Cacsms system EA folder/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Multi-terminal connections/i })).toBeInTheDocument();
    expect(screen.getAllByText(/MT5-Live-01/i).length).toBeGreaterThan(0);
  });
});

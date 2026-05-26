import { describe, expect, it } from "vitest";

import {
  buildInstallChecklist,
  buildSyncPreview,
  compareEaFolders,
  linkHealthScore,
  resolveConnectionFromBridge,
  resolveLinkStatus,
  validateTerminalRegistration
} from "@/modules/mt5-infrastructure-and-broker-connectivity/ea-terminal-hub/algorithms/ea-terminal-hub.algorithms";

const sampleFile = (name: string, size: number, hash: string | null = null) => ({
  name,
  relativePath: name,
  extension: ".ex5",
  sizeBytes: size,
  modifiedAt: "",
  contentHash: hash
});

describe("EA terminal hub algorithms", () => {
  it("detects drift between system and MT5 folders", () => {
    const result = compareEaFolders(
      [sampleFile("CacsmsBridge.ex5", 100, "aaa")],
      [sampleFile("LegacyEa.ex5", 80, "bbb")]
    );
    expect(result.missingInMt5).toBe(1);
    expect(result.missingInSystem).toBe(1);
  });

  it("detects hash mismatch when sizes match", () => {
    const result = compareEaFolders(
      [sampleFile("NexusBridgeEA/NexusBridgeEA.mq5", 100, "aaa")],
      [sampleFile("NexusBridgeEA/NexusBridgeEA.mq5", 100, "bbb")]
    );
    expect(result.hashMismatches).toBe(1);
    expect(result.drift[0]?.status).toBe("Hash Mismatch");
  });

  it("resolves link status from drift counts", () => {
    expect(resolveLinkStatus(true, 0, 0, 0, 0, "2026-01-01T00:00:00.000Z")).toBe("Linked");
    expect(resolveLinkStatus(true, 1, 0, 0, 0, "2026-01-01T00:00:00.000Z")).toBe("Drifted");
    expect(resolveLinkStatus(true, 0, 0, 0, 1, "2026-01-01T00:00:00.000Z")).toBe("Drifted");
    expect(resolveLinkStatus(false, 0, 0, 0, 0, null)).toBe("Missing Path");
  });

  it("derives connection status from bridge heartbeat", () => {
    expect(resolveConnectionFromBridge("Healthy")).toBe("Connected");
    expect(resolveConnectionFromBridge("Offline")).toBe("Disconnected");
    expect(resolveConnectionFromBridge("Critical")).toBe("Error");
  });

  it("scores link health from terminal states", () => {
    const score = linkHealthScore([
      { terminalId: "a", connectionStatus: "Connected", linkStatus: "Linked" } as never,
      { terminalId: "b", connectionStatus: "Disconnected", linkStatus: "Not Linked" } as never
    ]);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("builds install checklist for active terminal", () => {
    const checklist = buildInstallChecklist(
      {
        terminalId: "term-1",
        linkStatus: "Linked",
        connectionStatus: "Connected",
        mt5ExpertsPath: "C:\\MT5\\Experts",
        eaInstanceId: "ea-1",
        lastHeartbeatAt: new Date().toISOString(),
        driftFileCount: 0
      } as never,
      2
    );
    expect(checklist.length).toBeGreaterThan(0);
    expect(checklist.some((item) => item.status === "Complete")).toBe(true);
  });

  it("builds sync preview for missing artifacts", () => {
    const preview = buildSyncPreview([sampleFile("NexusBridgeEA/NexusBridgeEA.mq5", 100)], []);
    expect(preview).toHaveLength(1);
    expect(preview[0]?.action).toBe("Create");
  });

  it("validates terminal registration input", () => {
    expect(() =>
      validateTerminalRegistration({
        terminalName: "",
        terminalExecutablePath: "C:\\MT5\\terminal64.exe",
        brokerName: "Broker",
        accountLogin: "123456"
      })
    ).toThrow(/Terminal name/);
  });
});

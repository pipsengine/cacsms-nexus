import { describe, expect, it } from "vitest";

import { compareEaFolders, linkHealthScore, resolveLinkStatus } from "@/modules/mt5-infrastructure-and-broker-connectivity/ea-terminal-hub/algorithms/ea-terminal-hub.algorithms";

describe("EA terminal hub algorithms", () => {
  it("detects drift between system and MT5 folders", () => {
    const result = compareEaFolders(
      [{ name: "CacsmsBridge.ex5", relativePath: "CacsmsBridge.ex5", extension: ".ex5", sizeBytes: 100, modifiedAt: "" }],
      [{ name: "LegacyEa.ex5", relativePath: "LegacyEa.ex5", extension: ".ex5", sizeBytes: 80, modifiedAt: "" }]
    );
    expect(result.missingInMt5).toBe(1);
    expect(result.missingInSystem).toBe(1);
  });

  it("resolves link status from drift counts", () => {
    expect(resolveLinkStatus(true, 0, 0, 0, "2026-01-01T00:00:00.000Z")).toBe("Linked");
    expect(resolveLinkStatus(true, 1, 0, 0, "2026-01-01T00:00:00.000Z")).toBe("Drifted");
    expect(resolveLinkStatus(false, 0, 0, 0, null)).toBe("Missing Path");
  });

  it("scores link health from terminal states", () => {
    const score = linkHealthScore([
      {
        terminalId: "a",
        connectionStatus: "Connected",
        linkStatus: "Linked"
      } as never,
      {
        terminalId: "b",
        connectionStatus: "Disconnected",
        linkStatus: "Not Linked"
      } as never
    ]);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});

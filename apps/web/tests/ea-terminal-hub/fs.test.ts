import { describe, expect, it } from "vitest";

import { filterDeployableEaArtifacts } from "@/app/api/mt5/ea-terminal-hub/_lib/fs";

describe("EA deploy artifact filter", () => {
  it("deploys the NexusBridgeEA folder package and skips legacy flat files", () => {
    const deployable = filterDeployableEaArtifacts([
      { name: "NexusBridgeEA.mq5", relativePath: "NexusBridgeEA.mq5", extension: ".mq5", sizeBytes: 1, modifiedAt: "", contentHash: "a" },
      { name: "NexusBridgeEA.mq5", relativePath: "NexusBridgeEA/NexusBridgeEA.mq5", extension: ".mq5", sizeBytes: 1, modifiedAt: "", contentHash: "b" },
      { name: "NexusConfig.mqh", relativePath: "NexusBridgeEA/Cacsms/NexusConfig.mqh", extension: ".mqh", sizeBytes: 1, modifiedAt: "", contentHash: "c" },
      { name: "NexusConfig.mqh", relativePath: "Include/Cacsms/NexusConfig.mqh", extension: ".mqh", sizeBytes: 1, modifiedAt: "", contentHash: "d" }
    ]);

    expect(deployable.map((file) => file.relativePath)).toEqual([
      "NexusBridgeEA/NexusBridgeEA.mq5",
      "NexusBridgeEA/Cacsms/NexusConfig.mqh"
    ]);
  });
});

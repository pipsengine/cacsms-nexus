import { beforeEach, describe, expect, it } from "vitest";
import { buildRemoteControlHubResponse, remoteControlHubRole } from "@/app/api/autonomous-computer-operator/remote-control-hub/_lib/store";
import { seedConnectionHealthStore, seedEaBridgeStore, seedTerminalStatusStore } from "@/tests/helpers/seed-api-stores";

describe("Remote Control Hub API domain and security", () => {
  beforeEach(() => {
    seedTerminalStatusStore();
    seedEaBridgeStore();
    seedConnectionHealthStore();
  });

  it("defaults to infrastructure admin in local dev when no header provided", () => {
    expect(remoteControlHubRole(new Request("http://localhost/api/autonomous-computer-operator/remote-control-hub"))).toBe(
      "Infrastructure Admin"
    );
  });

  it("aggregates terminal, bridge, and host telemetry", async () => {
    const response = await buildRemoteControlHubResponse("Infrastructure Admin");
    expect(response.vpsComputers.length).toBeGreaterThan(0);
    expect(response.remoteSessions.length).toBeGreaterThan(0);
    expect(response.capabilities).toHaveLength(6);
    expect(response.meta.streamEndpoint).toContain("remote-control-hub");
  });

  it("honors highlighted host query parameter", async () => {
    const response = await buildRemoteControlHubResponse("Infrastructure Admin");
    const host = response.vpsComputers[0]?.hostMachine;
    if (!host) return;
    const highlighted = await buildRemoteControlHubResponse("Infrastructure Admin", host);
    expect(highlighted.meta.highlightedHost).toBe(host);
  });
});

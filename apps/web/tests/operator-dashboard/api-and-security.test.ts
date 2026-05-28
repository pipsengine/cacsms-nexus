import { beforeEach, describe, expect, it } from "vitest";
import { buildOperatorDashboardResponse, operatorDashboardRole } from "@/app/api/autonomous-computer-operator/operator-dashboard/_lib/store";
import {
  seedConnectionHealthStore,
  seedEaBridgeStore,
  seedExecutionQueueStore,
  seedOrderRouterStore,
  seedTerminalStatusStore
} from "@/tests/helpers/seed-api-stores";

describe("Operator Dashboard API domain and security", () => {
  beforeEach(() => {
    seedTerminalStatusStore();
    seedEaBridgeStore();
    seedConnectionHealthStore();
    seedOrderRouterStore();
    seedExecutionQueueStore();
  });

  it("defaults to infrastructure admin in local dev when no header provided", () => {
    expect(operatorDashboardRole(new Request("http://localhost/api/autonomous-computer-operator/operator-dashboard"))).toBe(
      "Infrastructure Admin"
    );
  });

  it("aggregates live MT5 telemetry into an operator response", async () => {
    const response = await buildOperatorDashboardResponse("Infrastructure Admin");
    expect(response.terminals.length).toBeGreaterThan(0);
    expect(response.hosts.length).toBeGreaterThan(0);
    expect(response.lanes).toHaveLength(4);
    expect(response.meta.streamEndpoint).toContain("operator-dashboard");
  });

  it("honors highlighted host query parameter", async () => {
    const response = await buildOperatorDashboardResponse("Infrastructure Admin");
    const host = response.hosts[0]?.hostMachine;
    if (!host) return;
    const highlighted = await buildOperatorDashboardResponse("Infrastructure Admin", host);
    expect(highlighted.meta.highlightedHost).toBe(host);
  });
});

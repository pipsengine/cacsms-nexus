import { beforeEach, describe, expect, it } from "vitest";
import { seedConnectionHealthStore } from "@/tests/helpers/seed-api-stores";

import {
  buildSummary,
  componentDiagnostics,
  componentReconnect,
  connectionHealthRole,
  dependencyMap,
  disableUnsafeTrading,
  incidents,
  isTradingSafe,
  resetConnectionHealthState
} from "@/app/api/mt5/connection-health/_lib/store";

describe("Connection Health operational controls", () => {
  beforeEach(() => seedConnectionHealthStore());

  it("builds summary KPIs and an overall score within range", () => {
    const summary = buildSummary("Infrastructure Admin");
    expect(summary.kpis).toHaveLength(12);
    expect(summary.overallHealth.score).toBeGreaterThanOrEqual(0);
    expect(summary.overallHealth.score).toBeLessThanOrEqual(100);
    expect(summary.infrastructureRiskLevel).toBeTruthy();
  });

  it("defaults to read-only role when no header provided", () => {
    expect(connectionHealthRole(new Request("http://localhost/api/mt5/connection-health/summary"))).toBe("Read-Only Viewer");
  });

  it("identifies a failed dependency link in the map response", () => {
    const map = dependencyMap();
    expect(map.firstFailedComponentId).toBeTruthy();
    expect(map.recommendedRecoverySequence.length).toBeGreaterThan(0);
  });

  it("creates a packet loss incident when packet loss exceeds threshold", () => {
    const list = incidents();
    expect(list.incidents.some((i) => i.incidentType === "Packet Loss")).toBe(true);
  });

  it("enforces permissions for reconnect and unsafe-trading disable", () => {
    expect(() => componentReconnect("cmp-017", "Analyst")).toThrow(/not authorized/i);
    expect(() => disableUnsafeTrading("Infrastructure Admin")).toThrow(/not authorized/i);
    expect(() => componentDiagnostics("cmp-017", "Analyst")).not.toThrow();
  });

  it("marks trading unsafe when global unsafe trading is disabled", () => {
    expect(isTradingSafe().safe).toBe(false);
    disableUnsafeTrading("Super Admin");
    const safe = isTradingSafe();
    expect(safe.safe).toBe(false);
    expect(safe.failures).toContain("Emergency stop active");
  });
});


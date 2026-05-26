import { beforeEach, describe, expect, it } from "vitest";
import { seedEaMonitoringStore } from "@/tests/helpers/seed-api-stores";

import {
  auditTrail,
  autoRemediate,
  disableTrading,
  eaMonitoringRole,
  enableTrading,
  exportReport,
  instanceDetail,
  listInstances,
  resetEaMonitoringState,
  restart,
  sync
} from "@/app/api/mt5/ea-monitoring/_lib/store";

describe("EA Monitoring API domain and security", () => {
  beforeEach(() => seedEaMonitoringStore());

  it("defaults to read-only role when no header provided", () => {
    expect(eaMonitoringRole(new Request("http://localhost/api/mt5/ea-monitoring/summary"))).toBe("Read-Only Viewer");
  });

  it("sync requires elevated roles", () => {
    expect(() => sync("Read-Only Viewer")).toThrow(/not authorized/i);
    expect(() => sync("Trading Admin")).not.toThrow();
  });

  it("restart requires infra/super roles", () => {
    const eaId = listInstances({ page: 1, pageSize: 10 }).instances[0]!.eaId;
    expect(() => restart("Trading Admin", eaId)).toThrow(/not authorized/i);
    expect(() => restart("Infrastructure Admin", eaId)).not.toThrow();
  });

  it("toggle trading restricted to trading/super roles and blocks readiness", () => {
    const eaId = listInstances({ page: 1, pageSize: 10 }).instances[0]!.eaId;

    expect(() => disableTrading("Read-Only Viewer", eaId)).toThrow(/not authorized/i);

    disableTrading("Trading Admin", eaId);
    const afterDisable = instanceDetail(eaId).instance;
    expect(afterDisable.tradingEnabled).toBe(false);
    expect(afterDisable.readiness.executionReady).toBe(false);
    expect(afterDisable.readiness.blockers).toContain("trading-disabled");

    enableTrading("Trading Admin", eaId);
    const afterEnable = instanceDetail(eaId).instance;
    expect(afterEnable.tradingEnabled).toBe(true);
  });

  it("auto-remediation restricted to super admin", () => {
    const eaId = listInstances({ page: 1, pageSize: 10 }).instances[0]!.eaId;
    expect(() => autoRemediate("Infrastructure Admin", eaId)).toThrow(/not authorized/i);
    expect(() => autoRemediate("Super Admin", eaId)).not.toThrow();
  });

  it("export allowed for viewer role and is audit logged", () => {
    const res = exportReport({ format: "json", filters: { status: "all", risk: "all", trading: "all" } as any }, "Read-Only Viewer");
    expect(res.ok).toBe(true);
    expect(res.message).toContain("generatedAt");
    expect(auditTrail().audit.length).toBeGreaterThan(0);
  });
});


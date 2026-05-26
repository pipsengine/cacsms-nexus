import { beforeEach, describe, expect, it } from "vitest";
import { seedExecutionQueueStore } from "@/tests/helpers/seed-api-stores";

import { buildSummary, emergencyStop, executionQueueRole, listItems, resetExecutionQueueState, retryItem, resumeQueue } from "@/app/api/mt5/execution-queue/_lib/store";

describe("Execution Queue operational controls", () => {
  beforeEach(() => seedExecutionQueueStore());

  it("builds summary sections with KPIs and workflow", () => {
    const summary = buildSummary("Infrastructure Admin");
    expect(summary.kpis).toHaveLength(12);
    expect(summary.workflow).toHaveLength(10);
    expect(summary.health.score).toBeGreaterThanOrEqual(0);
    expect(summary.health.score).toBeLessThanOrEqual(100);
  });

  it("defaults to read-only role when no header provided", () => {
    expect(executionQueueRole(new Request("http://localhost/api/mt5/execution-queue/summary"))).toBe("Read-Only Viewer");
  });

  it("enforces emergency stop restrictions and blocks resume while stopped", () => {
    expect(() => emergencyStop("Trading Admin")).toThrow(/not authorized/i);
    emergencyStop("Super Admin");
    expect(() => resumeQueue("Super Admin")).toThrow(/cannot resume/i);
  });

  it("blocks unsafe retries when duplicate check fails", () => {
    const items = listItems({ page: 1, pageSize: 200, status: "all", priority: "all" }).items;
    const duplicateBlocked = items.find((i) => i.duplicateCheckStatus === "Failed");
    expect(duplicateBlocked).toBeTruthy();
    expect(() => retryItem(duplicateBlocked!.queueId, "Trading Admin")).toThrow(/Unsafe retry blocked/i);
  });
});

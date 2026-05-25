import { describe, expect, it } from "vitest";

import { buildAiDiagnostics, buildReconciliation, buildSummary, buildTrades } from "@/app/api/mt5/trade-synchronization/build";

describe("trade synchronization API response shape", () => {
  it("buildSummary returns KPIs and workflow with bounded health score", () => {
    const summary = buildSummary();

    expect(summary).toHaveProperty("meta");
    expect(summary).toHaveProperty("kpis");
    expect(summary).toHaveProperty("workflow");

    expect(summary.workflow.length).toBe(10);

    const score = summary.kpis.tradeSyncHealthScore.score;
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
    expect(summary.kpis.tradeSyncHealthScore.explanation.length).toBeGreaterThan(0);
  });

  it("buildTrades returns a paged list with total", () => {
    const res = buildTrades({ search: "", status: "all", page: 1, pageSize: 50 });
    expect(res).toHaveProperty("meta.total");
    expect(res.trades.length).toBeGreaterThan(0);
  });

  it("buildAiDiagnostics returns structured diagnostics", () => {
    const res = buildAiDiagnostics();
    expect(res.diagnostics.length).toBeGreaterThan(0);
    expect(res.diagnostics[0]).toHaveProperty("issue");
    expect(res.diagnostics[0]).toHaveProperty("confidenceScore");
  });

  it("buildReconciliation returns comparisons for an existing trade", () => {
    const trades = buildTrades({ page: 1, pageSize: 1, status: "all" }).trades;
    const tradeId = trades[0]!.tradeId;
    const recon = buildReconciliation(tradeId);
    expect(recon.tradeId).toBe(tradeId);
    expect(recon.comparisons.length).toBeGreaterThan(0);
  });
});


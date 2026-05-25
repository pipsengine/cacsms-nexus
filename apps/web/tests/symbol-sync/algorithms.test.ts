import { describe, expect, it } from "vitest";
import { calculateSymbolHealth, classifyFeed, detectSymbolIssues, normalizeBrokerSymbol } from "@/modules/mt5-infrastructure-and-broker-connectivity/symbol-sync/algorithms/symbol-sync.algorithms";
import { createSymbolSyncSeed } from "@/modules/mt5-infrastructure-and-broker-connectivity/symbol-sync/data/symbol-sync.mock";

describe("symbol synchronization algorithms", () => {
  it("normalizes broker-specific contract variants into registry symbols", () => {
    expect(normalizeBrokerSymbol("EURUSDm")).toMatchObject({ normalizedSymbol: "EURUSD", known: true });
    expect(normalizeBrokerSymbol("EURUSD.pro")).toMatchObject({ normalizedSymbol: "EURUSD", assetClass: "Forex Major" });
    expect(normalizeBrokerSymbol("NASDAQ_ecn")).toMatchObject({ normalizedSymbol: "NAS100", assetClass: "Index" });
  });

  it("detects mapping conflicts, spread anomalies, and open-market feed gaps", () => {
    const issues = detectSymbolIssues(createSymbolSyncSeed().symbols);
    expect(issues.some((issue) => issue.issueType === "Mapping Mismatch" && issue.symbolId === "symbol-8")).toBe(true);
    expect(issues.some((issue) => issue.issueType === "Spread Anomaly" && issue.symbolId === "symbol-5")).toBe(true);
    expect(issues.some((issue) => issue.issueType === "Missing Tick" && issue.symbolId === "symbol-5")).toBe(true);
  });

  it("ignores closed-market missing ticks while scoring unsafe live data", () => {
    const seed = createSymbolSyncSeed().symbols;
    const closed = { ...seed[4], marketOpen: false };
    expect(classifyFeed(closed)).toBe("Inactive");
    expect(detectSymbolIssues([closed]).some((issue) => issue.issueType === "Missing Tick")).toBe(false);
    expect(calculateSymbolHealth(seed).rating).not.toBe("Excellent");
  });
});

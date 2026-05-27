import {describe, expect, it, beforeEach } from "vitest";
import { seedSymbolSyncStore } from "@/tests/helpers/seed-api-stores";
import { audits, autoRemediateSymbol, autonomousSyncSymbols, buildSymbolSyncResponse, ingestHeartbeatQuote, remapSymbol, resetSymbolSyncState, runSymbolDiagnostics, symbolRole, syncAllSymbols } from "@/app/api/mt5/symbol-sync/_lib/store";

describe("Symbol Sync operational controls", () => {
  beforeEach(() => seedSymbolSyncStore());
  it("returns monitoring, feed, workflow, and AI sections", () => {
    const response = buildSymbolSyncResponse("Infrastructure Admin");
    expect(response.kpis).toHaveLength(12);
    expect(response.workflow).toHaveLength(10);
    expect(response.feedMetrics.length).toBeGreaterThan(0);
    expect(response.issues.some((issue) => issue.issueType === "Mapping Mismatch")).toBe(true);
    expect(response.diagnostics.length).toBeGreaterThan(0);
  });

  it("enforces roles and operator confirmation", () => {
    expect(symbolRole(new Request("http://localhost/api/mt5/symbol-sync"))).toBe("Read-Only Viewer");
    expect(() => syncAllSymbols("Read-Only Viewer", true)).toThrow(/not authorized/);
    expect(() => syncAllSymbols("Infrastructure Admin", false)).toThrow(/Confirmation/);
    expect(() => runSymbolDiagnostics("Analyst", true)).toThrow(/not authorized/);
  });

  it("corrects a canonical mapping and audits safe remediation", () => {
    const before = audits().length;
    expect(remapSymbol("symbol-8", "EURUSD", "Infrastructure Admin", true).normalizedSymbol).toBe("EURUSD");
    expect(autoRemediateSymbol("symbol-diag-1", "Infrastructure Admin", true).symbol.tradingAllowed).toBe(false);
    expect(audits().length).toBeGreaterThan(before);
  });

  it("ingests live heartbeat quotes into the symbol registry", () => {
    resetSymbolSyncState();
    ingestHeartbeatQuote({
      brokerId: "broker-icm",
      brokerName: "IC Markets",
      accountId: "acct-1",
      accountLogin: "123456",
      serverName: "ICMarketsSC-Live23",
      symbol: "EURUSD.raw",
      bid: 1.08462,
      ask: 1.08464,
      marketDataActive: true,
      tradingEnabled: true,
      latencyMs: 42,
      receivedAt: new Date().toISOString()
    });
    const response = buildSymbolSyncResponse("Infrastructure Admin");
    expect(response.symbols).toHaveLength(1);
    expect(response.symbols[0]?.brokerSymbol).toBe("EURUSD.raw");
    expect(response.symbols[0]?.normalizedSymbol).toBe("EURUSD");
    expect(response.symbols[0]?.dataFeedActive).toBe(true);
  });

  it("autonomously syncs and validates symbols without operator confirmation", () => {
    resetSymbolSyncState();
    ingestHeartbeatQuote({
      brokerId: "broker-icm",
      brokerName: "IC Markets",
      accountId: "acct-1",
      accountLogin: "123456",
      symbol: "GBPUSD",
      bid: 1.27491,
      ask: 1.27495,
      marketDataActive: true,
      tradingEnabled: true,
      latencyMs: 38,
      receivedAt: new Date().toISOString()
    });
    autonomousSyncSymbols("heartbeat");
    const response = buildSymbolSyncResponse("Infrastructure Admin");
    expect(response.symbols[0]?.normalizedSymbol).toBe("GBPUSD");
    expect(response.symbols[0]?.mappingStatus).toBe("Healthy");
  });
});

import {describe, expect, it, beforeEach } from "vitest";
import { seedMarketWatchStore } from "@/tests/helpers/seed-api-stores";
import { audits, buildMarketWatchResponse, marketRole, refreshQuotes, resetMarketWatchState, runMarketDiagnostics, toggleWatchlist } from "@/app/api/mt5/market-watch/_lib/store";

describe("Market Watch operational controls", () => {
  beforeEach(() => seedMarketWatchStore());
  it("returns market quotes, sessions, alerts, movers, and diagnostics", () => {
    const response = buildMarketWatchResponse("Infrastructure Admin");
    expect(response.kpis).toHaveLength(8);
    expect(response.sessions).toHaveLength(4);
    expect(response.instruments.length).toBeGreaterThan(0);
    expect(response.alerts.some((alert) => alert.alertType === "Feed Offline")).toBe(true);
    expect(response.movers).toHaveLength(4);
    expect(response.diagnostics.length).toBeGreaterThan(0);
  });

  it("handles an empty live quote registry without throwing", () => {
    resetMarketWatchState();
    const response = buildMarketWatchResponse("Infrastructure Admin");
    expect(response.kpis.find((kpi) => kpi.label === "Largest Move")?.value).toBe("None");
    expect(response.instruments).toEqual([]);
  });

  it("enforces permissions and confirmation for market actions", () => {
    expect(marketRole(new Request("http://localhost/api/mt5/market-watch"))).toBe("Read-Only Viewer");
    expect(() => refreshQuotes("Read-Only Viewer", true)).toThrow(/not authorized/);
    expect(() => refreshQuotes("Infrastructure Admin", false)).toThrow(/Confirmation/);
    expect(() => runMarketDiagnostics("Analyst", true)).toThrow(/not authorized/);
  });

  it("updates watchlist membership and records an audit entry", () => {
    const before = audits().length;
    const old = buildMarketWatchResponse().instruments.find((instrument) => instrument.id === "mw-us30")!.watchlisted;
    expect(toggleWatchlist("mw-us30", "Analyst", true).watchlisted).toBe(!old);
    expect(audits().length).toBeGreaterThan(before);
  });
});

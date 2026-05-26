import { describe, expect, it } from "vitest";
import { calculateMarketHealth, dailyMovePercent, detectMarketAlerts, quoteStatus, spreadPoints, topMarketMovers } from "@/modules/mt5-infrastructure-and-broker-connectivity/market-watch/algorithms/market-watch.algorithms";
import { createMarketWatchSeed } from "@/tests/fixtures/market-watch.fixture";

describe("market watch algorithms", () => {
  it("calculates price movement and ranks instruments by absolute daily move", () => {
    const instruments = createMarketWatchSeed().instruments;
    expect(spreadPoints(instruments[0])).toBe(2);
    expect(dailyMovePercent(instruments[3])).toBeGreaterThan(0);
    expect(topMarketMovers(instruments)[0].symbol).toBe("BTCUSD");
  });

  it("detects offline feeds, stale quotes, expanded spreads, and restricted execution", () => {
    const alerts = detectMarketAlerts(createMarketWatchSeed().instruments);
    expect(alerts.some((alert) => alert.symbol === "NAS100" && alert.alertType === "Feed Offline")).toBe(true);
    expect(alerts.some((alert) => alert.symbol === "NAS100" && alert.alertType === "Trading Restricted")).toBe(true);
    expect(alerts.some((alert) => alert.alertType === "Spread Expansion")).toBe(true);
    expect(alerts.some((alert) => alert.symbol === "UKOIL" && alert.alertType === "Stale Quote")).toBe(true);
  });

  it("classifies unsafe quotes and reduces health for critical live-feed failures", () => {
    const instruments = createMarketWatchSeed().instruments;
    expect(quoteStatus(instruments.find((instrument) => instrument.symbol === "NAS100")!)).toBe("Offline");
    expect(calculateMarketHealth(instruments).rating).not.toBe("Excellent");
  });
});

import { describe, expect, it } from "vitest";

import {
  formatBrokerCatalogLabel,
  getBrokerCatalogEntry,
  MT5_BROKER_CATALOG
} from "@/modules/mt5-infrastructure-and-broker-connectivity/mt5-control-center/data/broker-catalog";

describe("MT5 broker catalog", () => {
  it("lists live and demo profiles with MT5 terminal server names", () => {
    expect(MT5_BROKER_CATALOG.some((entry) => entry.mt5ServerName === "ICMarketsSC-MT5")).toBe(true);
    expect(MT5_BROKER_CATALOG.some((entry) => entry.mt5ServerName === "Pepperstone-MT5-Live01")).toBe(true);
    expect(MT5_BROKER_CATALOG.some((entry) => entry.mt5ServerName === "Eightcap-Real")).toBe(true);
    expect(MT5_BROKER_CATALOG.every((entry) => entry.connectionMode === "MT5 Terminal")).toBe(true);
  });

  it("formats dropdown labels with environment and server", () => {
    const entry = getBrokerCatalogEntry("pepper-live");
    expect(entry).toBeTruthy();
    expect(formatBrokerCatalogLabel(entry!)).toBe("Pepperstone — Live (Pepperstone-MT5-Live01)");
  });
});

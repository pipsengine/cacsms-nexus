import type { TradeSyncTrade } from "@/modules/mt5-infrastructure-and-broker-connectivity/trade-synchronization/types/trade-synchronization.types";

export type MissingCloseEvent = {
  tradeId: string;
  mt5Ticket: string | null;
  reason: string;
};

export function detectMissingCloseEvents(trades: TradeSyncTrade[]) {
  return trades
    .filter((t) => t.mt5State === "CLOSED" && t.nexusState !== "CLOSED" && t.closeTime == null)
    .map<MissingCloseEvent>((t) => ({
      tradeId: t.tradeId,
      mt5Ticket: t.mt5Ticket,
      reason: "MT5 reports closed but Nexus still open and close event/time is missing."
    }));
}


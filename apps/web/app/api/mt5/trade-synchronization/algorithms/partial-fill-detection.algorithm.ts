import type { TradeSyncTrade } from "@/modules/mt5-infrastructure-and-broker-connectivity/trade-synchronization/types/trade-synchronization.types";

export type PartialFillDetection = {
  tradeId: string;
  mt5Ticket: string | null;
  requested: number;
  filled: number;
  reason: string;
};

export function detectPartialFills(trades: TradeSyncTrade[]) {
  return trades
    .filter((t) => t.volumeRequested > 0 && t.volumeFilled > 0 && t.volumeFilled + 1e-9 < t.volumeRequested)
    .map<PartialFillDetection>((t) => ({
      tradeId: t.tradeId,
      mt5Ticket: t.mt5Ticket,
      requested: t.volumeRequested,
      filled: t.volumeFilled,
      reason: "Filled volume is less than requested volume; treat as partial fill until fully confirmed."
    }));
}


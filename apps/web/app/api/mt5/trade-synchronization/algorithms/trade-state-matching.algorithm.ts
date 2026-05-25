import type { StateMatchStatus, TradeSyncTrade } from "@/modules/mt5-infrastructure-and-broker-connectivity/trade-synchronization/types/trade-synchronization.types";

import { clampScore, safeNumber, safeString } from "./utils";

export type TradeStateMatchResult = {
  status: StateMatchStatus;
  score: number;
  issues: string[];
  factors: Record<string, number>;
};

function near(a: number, b: number, tolerance: number) {
  return Math.abs(a - b) <= tolerance;
}

export function matchTradeState(trade: TradeSyncTrade | null): TradeStateMatchResult {
  if (!trade) {
    return { status: "Missing in Nexus", score: 0, issues: ["Trade missing in Nexus."], factors: {} };
  }

  const issues: string[] = [];
  const factors: Record<string, number> = {};

  const ticketExists = Boolean(trade.mt5Ticket);
  factors.ticketExists = ticketExists ? 100 : 0;
  if (!ticketExists) issues.push("MT5 ticket missing.");

  const stateMatches = safeString(trade.nexusState) === safeString(trade.mt5State);
  factors.stateMatch = stateMatches ? 100 : 0;
  if (!stateMatches) issues.push(`State mismatch (nexus=${trade.nexusState}, mt5=${trade.mt5State}).`);

  const volumeRequested = safeNumber(trade.volumeRequested);
  const volumeFilled = safeNumber(trade.volumeFilled);
  const volumeOk = volumeFilled <= volumeRequested + 1e-9 && (volumeRequested === 0 ? volumeFilled === 0 : volumeFilled >= 0);
  const volumeScore = clampScore(volumeOk ? 100 : 0);
  factors.volumeMatch = volumeScore;
  if (!volumeOk) issues.push("Volume mismatch (filled > requested).");

  const entryPriceOk =
    trade.entryPrice === 0 || trade.currentPrice === 0 ? true : near(safeNumber(trade.entryPrice), safeNumber(trade.entryPrice), 0.0001);
  factors.entryPriceMatch = entryPriceOk ? 100 : 90;

  const slOk =
    trade.stopLoss == null ||
    trade.stopLoss === 0 ||
    (trade.direction === "Buy" ? trade.stopLoss < trade.entryPrice : trade.stopLoss > trade.entryPrice);
  factors.slValidity = slOk ? 100 : 0;
  if (!slOk) issues.push("Stop loss invalid relative to entry and direction.");

  const tpOk =
    trade.takeProfit == null ||
    trade.takeProfit === 0 ||
    (trade.direction === "Buy" ? trade.takeProfit > trade.entryPrice : trade.takeProfit < trade.entryPrice);
  factors.tpValidity = tpOk ? 100 : 0;
  if (!tpOk) issues.push("Take profit invalid relative to entry and direction.");

  const closeEventOk = trade.mt5State === "CLOSED" ? Boolean(trade.closeTime) : true;
  factors.closeEvent = closeEventOk ? 100 : 0;
  if (!closeEventOk) issues.push("Close time missing while MT5 reports closed.");

  const plOk = trade.tradeStatus !== "Closed" ? true : Number.isFinite(trade.netProfitLoss);
  factors.plReconciled = plOk ? 100 : 60;
  if (!plOk) issues.push("P/L reconciliation missing or invalid.");

  const severity = issues.length;
  const baseScore = clampScore(
    (factors.ticketExists +
      factors.stateMatch +
      factors.volumeMatch +
      factors.slValidity +
      factors.tpValidity +
      factors.closeEvent +
      factors.plReconciled) /
      7
  );

  const status: StateMatchStatus =
    !ticketExists ? "Missing in MT5" : severity === 0 ? "Matched" : severity <= 2 ? "Minor Difference" : "Material Difference";

  const score = clampScore(baseScore - (status === "Material Difference" ? 20 : status === "Minor Difference" ? 8 : 0));

  return { status, score, issues, factors };
}


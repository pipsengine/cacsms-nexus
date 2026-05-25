import type { TradeSyncScore, TradeSyncTrade } from "@/modules/mt5-infrastructure-and-broker-connectivity/trade-synchronization/types/trade-synchronization.types";

import { detectMissingCloseEvents } from "./missing-close-event-detection.algorithm";
import { detectPartialFills } from "./partial-fill-detection.algorithm";
import { matchTradeState } from "./trade-state-matching.algorithm";
import { clampScore, safeNumber } from "./utils";

export function calculateTradeSyncHealthScore(trades: TradeSyncTrade[]): TradeSyncScore {
  const total = trades.length || 1;

  const ticketMatchScore =
    (trades.filter((t) => Boolean(t.mt5Ticket)).length / total) * 100;

  const matchResults = trades.map((t) => matchTradeState(t));
  const stateMatchScore = matchResults.reduce((sum, r) => sum + r.factors.stateMatch, 0) / total;
  const volumeMatchScore = matchResults.reduce((sum, r) => sum + r.factors.volumeMatch, 0) / total;
  const slTpMatchScore = (matchResults.reduce((sum, r) => sum + r.factors.slValidity + r.factors.tpValidity, 0) / (total * 2)) || 0;

  const lifecycleCompletenessScore = clampScore(
    100 - (detectMissingCloseEvents(trades).length / total) * 70 - (detectPartialFills(trades).length / total) * 20
  );

  const profitLossReconciliationScore = clampScore(
    100 -
      (trades.filter((t) => t.tradeStatus === "Closed" && !Number.isFinite(t.netProfitLoss)).length / total) * 60
  );

  const averageDelay = trades.length ? trades.reduce((s, t) => s + safeNumber(t.syncDelaySeconds), 0) / total : 0;
  const delayPenalty = clampScore(Math.min(40, averageDelay / 6));

  const mismatchCount = trades.filter((t) => t.stateMatchStatus !== "Matched").length;
  const mismatchPenalty = clampScore(Math.min(50, (mismatchCount / total) * 90));

  const score = clampScore(
    ticketMatchScore +
      stateMatchScore +
      volumeMatchScore +
      slTpMatchScore +
      lifecycleCompletenessScore +
      profitLossReconciliationScore -
      delayPenalty -
      mismatchPenalty
  );

  const explanation =
    score >= 90
      ? "Excellent synchronization posture with minimal mismatch and low delay."
      : score >= 75
        ? "Healthy synchronization posture with manageable drift and recoverable exceptions."
        : score >= 60
          ? "Degraded synchronization posture; reconciliation and diagnostics recommended."
          : score >= 40
            ? "High risk synchronization posture; freeze unsafe updates and reconcile immediately."
            : "Critical synchronization posture; emergency freeze and full reconciliation required.";

  return {
    score,
    explanation,
    factors: {
      ticketMatchScore: clampScore(ticketMatchScore),
      stateMatchScore: clampScore(stateMatchScore),
      volumeMatchScore: clampScore(volumeMatchScore),
      slTpMatchScore: clampScore(slTpMatchScore),
      lifecycleCompletenessScore,
      profitLossReconciliationScore
    },
    penalties: {
      delayPenalty,
      mismatchPenalty
    }
  };
}


import { NextResponse } from "next/server";

import { requireRole } from "../auth";
import { appendTradeSyncLog, getTradeSyncState, listTrades, updateTrade } from "../store";

export function POST(request: Request) {
  const state = getTradeSyncState();
  const { response, role } = requireRole(request, ["Super Admin", "Trading Admin", "Risk Manager"], "Reconcile all trades", state.frozen);
  if (response) return response;
  if (state.frozen) {
    return NextResponse.json({ meta: { timestamp: new Date().toISOString(), frozen: true }, ok: false, message: "Trade sync is frozen." }, { status: 423 });
  }

  const affected = listTrades()
    .map((t) => t.tradeId)
    .slice(0, 50);

  for (const id of affected) {
    updateTrade(id, { stateMatchStatus: "Matched", syncStatus: "Synced", lastSyncAt: new Date().toISOString(), syncDelaySeconds: 9 });
  }

  appendTradeSyncLog({
    timestamp: new Date().toISOString(),
    tradeId: null,
    mt5Ticket: null,
    account: null,
    broker: null,
    exceptionType: "Audit",
    severity: "Info",
    errorMessage: `Reconcile all invoked (${affected.length} trades).`,
    rootCause: `Actor role: ${role}`,
    retryCount: 0,
    resolutionStatus: "Resolved",
    aiExplanation: "Bulk reconciliation executed; escalate material differences for review."
  });

  return NextResponse.json({ meta: { timestamp: new Date().toISOString(), frozen: state.frozen }, ok: true, message: "Reconciled all trades (mock).", affectedTradeIds: affected });
}

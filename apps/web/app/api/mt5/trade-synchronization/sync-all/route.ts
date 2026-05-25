import { NextResponse } from "next/server";

import { requireRole } from "../auth";
import { appendTradeSyncLog, getTradeSyncState, listTrades, updateTrade } from "../store";

export function POST(request: Request) {
  const state = getTradeSyncState();
  const { response, role } = requireRole(request, ["Super Admin", "Trading Admin"], "Sync all trades", state.frozen);
  if (response) return response;
  if (state.frozen) {
    return NextResponse.json({ meta: { timestamp: new Date().toISOString(), frozen: true }, ok: false, message: "Trade sync is frozen." }, { status: 423 });
  }

  const affected = listTrades()
    .map((t) => t.tradeId)
    .slice(0, 50);

  for (const id of affected) {
    updateTrade(id, { syncStatus: "Synced", stateMatchStatus: "Matched", lastSyncAt: new Date().toISOString(), syncDelaySeconds: 6 });
  }

  appendTradeSyncLog({
    timestamp: new Date().toISOString(),
    tradeId: null,
    mt5Ticket: null,
    account: null,
    broker: null,
    exceptionType: "Audit",
    severity: "Info",
    errorMessage: `Sync all invoked (${affected.length} trades).`,
    rootCause: `Actor role: ${role}`,
    retryCount: 0,
    resolutionStatus: "Resolved",
    aiExplanation: "Bulk sync executed; monitor mismatches and reconcile material differences."
  });

  return NextResponse.json({ meta: { timestamp: new Date().toISOString(), frozen: state.frozen }, ok: true, message: "All trades synchronized (mock).", affectedTradeIds: affected });
}

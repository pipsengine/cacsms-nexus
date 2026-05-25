import { NextResponse } from "next/server";

import { requireRole } from "../../../auth";
import { appendTradeSyncLog, getTrade, getTradeSyncState, updateTrade } from "../../../store";

export function POST(request: Request, context: { params: Promise<{ tradeId: string }> }) {
  return context.params.then(({ tradeId }) => {
    const state = getTradeSyncState();
    const { response, role } = requireRole(request, ["Super Admin", "Trading Admin", "Risk Manager"], "Reconcile trade", state.frozen);
    if (response) return response;
    if (state.frozen) {
      return NextResponse.json({ meta: { timestamp: new Date().toISOString(), frozen: true }, ok: false, message: "Trade sync is frozen." }, { status: 423 });
    }

    const trade = getTrade(tradeId);
    const updated = updateTrade(tradeId, {
      stateMatchStatus: "Matched",
      syncStatus: "Synced",
      lastSyncAt: new Date().toISOString(),
      syncDelaySeconds: 8
    });

    if (!updated) {
      return NextResponse.json({ meta: { timestamp: new Date().toISOString(), frozen: state.frozen }, ok: false, message: "Trade not found." }, { status: 404 });
    }

    appendTradeSyncLog({
      timestamp: new Date().toISOString(),
      tradeId,
      mt5Ticket: trade?.mt5Ticket ?? null,
      account: trade?.account ?? null,
      broker: trade?.broker ?? null,
      exceptionType: "Audit",
      severity: "Info",
      errorMessage: "Reconcile trade invoked.",
      rootCause: `Actor role: ${role}`,
      retryCount: 0,
      resolutionStatus: "Resolved",
      aiExplanation: "Trade reconciled; apply lifecycle and P/L reconciliation validation."
    });

    return NextResponse.json({
      meta: { timestamp: new Date().toISOString(), frozen: state.frozen },
      ok: true,
      message: "Trade reconciled (mock).",
      affectedTradeIds: [tradeId]
    });
  });
}

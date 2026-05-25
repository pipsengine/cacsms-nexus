import { NextResponse } from "next/server";

import { requireRole } from "../../../auth";
import { appendTradeSyncLog, getTrade, getTradeSyncState, updateTrade } from "../../../store";

export function POST(request: Request, context: { params: Promise<{ tradeId: string }> }) {
  return context.params.then(({ tradeId }) => {
    const state = getTradeSyncState();
    const { response, role } = requireRole(request, ["Super Admin", "Trading Admin"], "Sync trade", state.frozen);
    if (response) return response;
    if (state.frozen) {
      return NextResponse.json(
        { meta: { timestamp: new Date().toISOString(), frozen: true }, ok: false, message: "Trade sync is frozen." },
        { status: 423 }
      );
    }

    const trade = getTrade(tradeId);
    const updated = updateTrade(tradeId, { syncStatus: "Synced", stateMatchStatus: "Matched", lastSyncAt: new Date().toISOString(), syncDelaySeconds: 6 });
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
      errorMessage: "Sync trade invoked.",
      rootCause: `Actor role: ${role}`,
      retryCount: 0,
      resolutionStatus: "Resolved",
      aiExplanation: "Trade synced; re-run reconciliation if state mismatch persists."
    });

    return NextResponse.json({
      meta: { timestamp: new Date().toISOString(), frozen: state.frozen },
      ok: true,
      message: "Trade synchronized (mock).",
      affectedTradeIds: [tradeId]
    });
  });
}

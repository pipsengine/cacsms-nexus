import { NextResponse } from "next/server";

import { requireRole } from "../auth";
import { appendTradeSyncLog, getTradeSyncState, getTrade, updateTrade } from "../store";

export async function POST(request: Request) {
  const state = getTradeSyncState();
  const { response, role } = requireRole(request, ["Super Admin", "Trading Admin"], "Sync selected trades", state.frozen);
  if (response) return response;
  if (state.frozen) {
    return NextResponse.json({ meta: { timestamp: new Date().toISOString(), frozen: true }, ok: false, message: "Trade sync is frozen." }, { status: 423 });
  }

  const body = (await request.json().catch(() => null)) as { tradeIds?: string[] } | null;
  const tradeIds = body?.tradeIds ?? [];

  const affected: string[] = [];
  for (const id of tradeIds) {
    const trade = getTrade(id);
    const updated = updateTrade(id, { syncStatus: "Synced", stateMatchStatus: "Matched", lastSyncAt: new Date().toISOString(), syncDelaySeconds: 7 });
    if (updated) {
      affected.push(id);
      appendTradeSyncLog({
        timestamp: new Date().toISOString(),
        tradeId: id,
        mt5Ticket: trade?.mt5Ticket ?? null,
        account: trade?.account ?? null,
        broker: trade?.broker ?? null,
        exceptionType: "Audit",
        severity: "Info",
        errorMessage: "Sync selected trade invoked.",
        rootCause: `Actor role: ${role}`,
        retryCount: 0,
        resolutionStatus: "Resolved",
        aiExplanation: "Selected trade synced; validate state and lifecycle completeness."
      });
    }
  }

  return NextResponse.json({ meta: { timestamp: new Date().toISOString(), frozen: state.frozen }, ok: true, message: "Selected trades synchronized (mock).", affectedTradeIds: affected });
}

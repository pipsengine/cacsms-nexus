import { NextResponse } from "next/server";

import { buildAiDiagnostics } from "../build";
import { requireRole } from "../auth";
import { appendTradeSyncLog, getTrade, getTradeSyncState, updateTrade } from "../store";

export function POST(request: Request) {
  const state = getTradeSyncState();
  const { response, role } = requireRole(request, ["Super Admin", "Trading Admin", "Infrastructure Admin"], "Auto-remediate", state.frozen);
  if (response) return response;

  if (state.frozen) {
    return NextResponse.json({ meta: { timestamp: new Date().toISOString(), frozen: true }, ok: false, message: "Trade sync is frozen." }, { status: 423 });
  }

  const diagnostics = buildAiDiagnostics().diagnostics;
  const eligible = diagnostics.filter((d) => d.autoFixEligible && d.affectedTradeId);

  const affected: string[] = [];
  for (const d of eligible) {
    const id = d.affectedTradeId!;
    const trade = getTrade(id);
    if (!trade) continue;
    updateTrade(id, { syncStatus: "Synced", stateMatchStatus: "Matched", lastSyncAt: new Date().toISOString(), syncDelaySeconds: 5 });
    affected.push(id);

    appendTradeSyncLog({
      timestamp: new Date().toISOString(),
      tradeId: id,
      mt5Ticket: trade.mt5Ticket,
      account: trade.account,
      broker: trade.broker,
      exceptionType: "Auto-remediation",
      severity: "Info",
      errorMessage: `Auto-remediated: ${d.issue}`,
      rootCause: `Actor role: ${role}`,
      retryCount: 0,
      resolutionStatus: "Resolved",
      aiExplanation: d.recommendedAction
    });
  }

  return NextResponse.json({
    meta: { timestamp: new Date().toISOString(), frozen: state.frozen },
    ok: true,
    message: affected.length ? "Auto-remediation applied (mock)." : "No eligible auto-remediation actions found.",
    affectedTradeIds: affected
  });
}


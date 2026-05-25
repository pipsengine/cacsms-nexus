import { NextResponse } from "next/server";

import { requireRole } from "../auth";
import { appendTradeSyncLog, getTradeSyncState, setFrozen } from "../store";

export function POST(request: Request) {
  const state = getTradeSyncState();
  const { response, role } = requireRole(request, ["Super Admin"], "Emergency freeze", state.frozen);
  if (response) return response;

  setFrozen(true);
  appendTradeSyncLog({
    timestamp: new Date().toISOString(),
    tradeId: null,
    mt5Ticket: null,
    account: null,
    broker: null,
    exceptionType: "Emergency Freeze",
    severity: "Critical",
    errorMessage: "Trade synchronization frozen by operator.",
    rootCause: `Actor role: ${role}`,
    retryCount: 0,
    resolutionStatus: "Resolved",
    aiExplanation: "Freeze blocks unsafe state mutations until reconciliation confirms trusted state."
  });

  return NextResponse.json({
    meta: { timestamp: new Date().toISOString(), frozen: true },
    ok: true,
    message: "Trade sync frozen."
  });
}


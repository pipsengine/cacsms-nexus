import { NextResponse } from "next/server";

import { getMockModifications } from "@/modules/mt5-infrastructure-and-broker-connectivity/trade-synchronization/data/trade-synchronization.mock";
import { getTrade } from "../../../store";

export function GET(_request: Request, context: { params: Promise<{ tradeId: string }> }) {
  return context.params.then(({ tradeId }) => {
    const trade = getTrade(tradeId);
    if (!trade) {
      return NextResponse.json({ message: "Trade not found." }, { status: 404 });
    }
    return NextResponse.json(getMockModifications(tradeId, trade.mt5Ticket), { headers: { "cache-control": "no-store" } });
  });
}


import { NextResponse } from "next/server";

import { getTrade } from "../../store";

export function GET(_request: Request, context: { params: Promise<{ tradeId: string }> }) {
  return context.params.then(({ tradeId }) => {
    const trade = getTrade(tradeId);
    if (!trade) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(trade, { headers: { "cache-control": "no-store" } });
  });
}


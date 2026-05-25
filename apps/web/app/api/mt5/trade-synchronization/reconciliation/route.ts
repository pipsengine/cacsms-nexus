import { NextResponse } from "next/server";

import { buildReconciliation } from "../build";

export function GET(request: Request) {
  const url = new URL(request.url);
  const tradeId = url.searchParams.get("tradeId") ?? undefined;
  return NextResponse.json(buildReconciliation(tradeId), { headers: { "cache-control": "no-store" } });
}


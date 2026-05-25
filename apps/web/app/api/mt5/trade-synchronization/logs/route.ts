import { NextResponse } from "next/server";

import { buildLogs } from "../build";

export function GET(request: Request) {
  const url = new URL(request.url);
  const filter = url.searchParams.get("filter") ?? undefined;
  return NextResponse.json(buildLogs(filter), { headers: { "cache-control": "no-store" } });
}


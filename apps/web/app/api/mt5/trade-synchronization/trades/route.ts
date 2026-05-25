import { NextResponse } from "next/server";

import { buildTrades } from "../build";

export function GET(request: Request) {
  const url = new URL(request.url);
  const search = url.searchParams.get("search") ?? undefined;
  const status = url.searchParams.get("status") ?? undefined;
  const page = url.searchParams.get("page") ? Number(url.searchParams.get("page")) : undefined;
  const pageSize = url.searchParams.get("pageSize") ? Number(url.searchParams.get("pageSize")) : undefined;

  return NextResponse.json(buildTrades({ search, status, page, pageSize }), { headers: { "cache-control": "no-store" } });
}


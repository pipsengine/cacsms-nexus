import { NextResponse } from "next/server";

import { buildExceptions } from "../build";

export function GET(request: Request) {
  const url = new URL(request.url);
  const filter = url.searchParams.get("filter") ?? undefined;
  return NextResponse.json(buildExceptions(filter), { headers: { "cache-control": "no-store" } });
}


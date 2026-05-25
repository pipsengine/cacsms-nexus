import { NextResponse } from "next/server";

import { buildSummary } from "../build";

export function GET() {
  return NextResponse.json(buildSummary(), { headers: { "cache-control": "no-store" } });
}


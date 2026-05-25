import { NextResponse } from "next/server";

import { buildAiDiagnostics } from "../build";

export function GET() {
  return NextResponse.json(buildAiDiagnostics(), { headers: { "cache-control": "no-store" } });
}


import { NextResponse } from "next/server";

import { buildExecutiveDashboardResponse } from "./build-response";

export function GET() {
  const payload = buildExecutiveDashboardResponse();
  return NextResponse.json(payload, {
    headers: {
      "cache-control": "no-store"
    }
  });
}


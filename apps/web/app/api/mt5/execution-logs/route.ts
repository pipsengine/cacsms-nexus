import type { NextRequest } from "next/server";

import { failure, ok } from "../_lib/http";
import { listLogs } from "./_lib/store";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  try {
    const search = url.searchParams.get("search") ?? undefined;
    const status = url.searchParams.get("status") ?? undefined;
    const brokerId = url.searchParams.get("brokerId") ?? undefined;
    const symbol = url.searchParams.get("symbol") ?? undefined;
    const reviewed = url.searchParams.get("reviewed") ?? undefined;
    const page = url.searchParams.get("page") ? Number(url.searchParams.get("page")) : undefined;
    const pageSize = url.searchParams.get("pageSize") ? Number(url.searchParams.get("pageSize")) : undefined;
    return ok(listLogs({ search, status: status as any, brokerId, symbol, reviewed, page, pageSize }));
  } catch (e) {
    return failure(e);
  }
}


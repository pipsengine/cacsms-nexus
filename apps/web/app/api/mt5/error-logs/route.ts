import type { NextRequest } from "next/server";

import { failure, ok } from "../_lib/http";
import { listErrors } from "./_lib/store";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  try {
    const search = url.searchParams.get("search") ?? undefined;
    const severity = url.searchParams.get("severity") ?? undefined;
    const module = url.searchParams.get("module") ?? undefined;
    const status = url.searchParams.get("status") ?? undefined;
    const brokerId = url.searchParams.get("brokerId") ?? undefined;
    const page = url.searchParams.get("page") ? Number(url.searchParams.get("page")) : undefined;
    const pageSize = url.searchParams.get("pageSize") ? Number(url.searchParams.get("pageSize")) : undefined;
    return ok(listErrors({ search, severity: severity as any, module: module as any, status: status as any, brokerId, page, pageSize }));
  } catch (e) {
    return failure(e);
  }
}

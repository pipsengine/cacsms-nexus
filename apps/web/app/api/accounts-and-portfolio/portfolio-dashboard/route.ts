import type { NextRequest } from "next/server";

import { failure, ok } from "../../mt5/_lib/http";
import { buildPortfolioDashboardResponse, portfolioDashboardRole } from "./_lib/store";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const role = portfolioDashboardRole(request);
    const accountId = request.nextUrl.searchParams.get("accountId");
    return ok(await buildPortfolioDashboardResponse(role, accountId));
  } catch (error) {
    return failure(error);
  }
}

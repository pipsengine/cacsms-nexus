import type { NextRequest } from "next/server";

import { failure, ok } from "../../mt5/_lib/http";
import { buildOperatorDashboardResponse, operatorDashboardRole } from "./_lib/store";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const role = operatorDashboardRole(request);
    const host = request.nextUrl.searchParams.get("host");
    return ok(await buildOperatorDashboardResponse(role, host));
  } catch (error) {
    return failure(error);
  }
}

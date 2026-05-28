import type { NextRequest } from "next/server";

import { failure, ok } from "../../mt5/_lib/http";
import { buildDesktopAutomationHubResponse, desktopAutomationHubRole } from "./_lib/store";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const role = desktopAutomationHubRole(request);
    const terminalId = request.nextUrl.searchParams.get("terminalId");
    return ok(await buildDesktopAutomationHubResponse(role, terminalId));
  } catch (error) {
    return failure(error);
  }
}

import type { NextRequest } from "next/server";

import { failure, ok } from "../../mt5/_lib/http";
import { buildRemoteControlHubResponse, remoteControlHubRole } from "./_lib/store";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const role = remoteControlHubRole(request);
    const host = request.nextUrl.searchParams.get("host");
    return ok(await buildRemoteControlHubResponse(role, host));
  } catch (error) {
    return failure(error);
  }
}

import type { NextRequest } from "next/server";

import { failure } from "../../../mt5/_lib/http";
import { createMt5EventStream } from "../../../mt5/_lib/realtime-stream";
import { buildRemoteControlHubResponse, remoteControlHubRole } from "../_lib/store";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, context: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await context.params;
  const role = remoteControlHubRole(request);
  const host = request.nextUrl.searchParams.get("host");

  try {
    if (slug[0] === "events-stream") {
      return createMt5EventStream({
        request,
        eventName: "remote-control-hub-snapshot",
        snapshot: () => buildRemoteControlHubResponse(role, host)
      });
    }
    throw new Error("not found");
  } catch (error) {
    if (error instanceof Error && error.message === "not found") {
      return failure(new Error("Remote control hub endpoint not found."));
    }
    return failure(error);
  }
}

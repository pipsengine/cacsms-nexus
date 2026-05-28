import type { NextRequest } from "next/server";

import { failure, ok } from "../../../mt5/_lib/http";
import { createMt5EventStream } from "../../../mt5/_lib/realtime-stream";
import { buildRiskAndExposureResponse, riskAndExposureRole } from "../_lib/store";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, context: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await context.params;
  const role = riskAndExposureRole(request);
  const accountId = request.nextUrl.searchParams.get("accountId");

  try {
    if (slug[0] === "events-stream") {
      return createMt5EventStream({
        request,
        eventName: "risk-and-exposure-snapshot",
        snapshot: () => buildRiskAndExposureResponse(role, accountId)
      });
    }
    throw new Error("not found");
  } catch (error) {
    if (error instanceof Error && error.message === "not found") {
      return failure(new Error("Risk and exposure endpoint not found."));
    }
    return failure(error);
  }
}

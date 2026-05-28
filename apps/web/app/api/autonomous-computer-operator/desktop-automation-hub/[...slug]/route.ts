import type { NextRequest } from "next/server";

import { failure, ok } from "../../../mt5/_lib/http";
import { createMt5EventStream } from "../../../mt5/_lib/realtime-stream";
import {
  buildDesktopAutomationHubResponse,
  cancelAutomationRun,
  desktopAutomationHubRole,
  executeAutomationRun,
  startTopDownAnalysis
} from "../_lib/store";
import type { TopDownAnalysisInput } from "@/modules/autonomous-computer-operator/desktop-automation-hub/types/desktop-automation-hub.types";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, context: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await context.params;
  const role = desktopAutomationHubRole(request);
  const terminalId = request.nextUrl.searchParams.get("terminalId");

  try {
    if (slug[0] === "events-stream") {
      return createMt5EventStream({
        request,
        eventName: "desktop-automation-hub-snapshot",
        snapshot: () => buildDesktopAutomationHubResponse(role, terminalId)
      });
    }
    throw new Error("not found");
  } catch (error) {
    if (error instanceof Error && error.message === "not found") {
      return failure(new Error("Desktop automation hub endpoint not found."));
    }
    return failure(error);
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await context.params;
  const role = desktopAutomationHubRole(request);

  try {
    if (slug[0] === "top-down" && slug[1] === "start") {
      const body = (await request.json()) as TopDownAnalysisInput & { confirmed?: boolean };
      if (!body.confirmed) throw new Error("Confirmation is required to start autonomous desktop automation.");
      return ok(await startTopDownAnalysis(body, role, request));
    }
    if (slug[0] === "runs" && slug[2] === "execute" && slug[1]) {
      return ok(await executeAutomationRun(slug[1], role, request));
    }
    if (slug[0] === "runs" && slug[2] === "cancel" && slug[1]) {
      return ok(cancelAutomationRun(slug[1], role));
    }
    throw new Error("not found");
  } catch (error) {
    if (error instanceof Error && error.message === "not found") {
      return failure(new Error("Desktop automation hub endpoint not found."));
    }
    return failure(error);
  }
}

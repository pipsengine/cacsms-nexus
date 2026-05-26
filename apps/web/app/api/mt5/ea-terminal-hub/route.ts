import type { NextRequest } from "next/server";

import { failure, ok } from "../_lib/http";
import { withMt5Module } from "../_lib/ensure-ready";
import { buildEaTerminalHubResponse, eaTerminalHubRole } from "./_lib/store";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    return ok(await withMt5Module("ea-terminal-hub", () => buildEaTerminalHubResponse(eaTerminalHubRole(request))));
  } catch (error) {
    return failure(error);
  }
}

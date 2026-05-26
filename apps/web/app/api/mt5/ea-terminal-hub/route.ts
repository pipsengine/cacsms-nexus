import type { NextRequest } from "next/server";

import { failure, ok } from "../_lib/http";
import { buildEaTerminalHubResponse, eaTerminalHubRole } from "./_lib/store";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    return ok(await buildEaTerminalHubResponse(eaTerminalHubRole(request)));
  } catch (error) {
    return failure(error);
  }
}

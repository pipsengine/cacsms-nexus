import { ok } from "../_lib/http";
import { buildEaBridgeResponse, eaBridgeRole } from "./_lib/store";
import { withEaBridgeStore } from "./_lib/handler";

export async function GET(request: Request) {
  return ok(await withEaBridgeStore(() => buildEaBridgeResponse(eaBridgeRole(request))));
}

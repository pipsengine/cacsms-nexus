import { ok } from "../_lib/http";
import { buildEaBridgeResponse, eaBridgeRole } from "./_lib/store";

export function GET(request: Request) {
  return ok(buildEaBridgeResponse(eaBridgeRole(request)));
}

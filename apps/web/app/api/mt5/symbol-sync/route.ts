import { ok } from "../_lib/http";
import { buildSymbolSyncResponse, symbolRole } from "./_lib/store";

export function GET(request: Request) {
  return ok(buildSymbolSyncResponse(symbolRole(request)));
}

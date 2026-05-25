import { ok } from "../_lib/http";
import { buildMarketWatchResponse, marketRole } from "./_lib/store";

export function GET(request: Request) {
  return ok(buildMarketWatchResponse(marketRole(request)));
}

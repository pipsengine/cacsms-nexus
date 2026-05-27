import { createMt5EventStream } from "../../_lib/realtime-stream";
import { buildMarketWatchResponse, marketRole } from "../_lib/store";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const role = marketRole(request);
  return createMt5EventStream({
    request,
    eventName: "market-snapshot",
    snapshot: () => buildMarketWatchResponse(role)
  });
}

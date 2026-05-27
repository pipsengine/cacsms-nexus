import { createMt5EventStream } from "../../_lib/realtime-stream";
import { buildSymbolSyncResponse, symbolRole } from "../_lib/store";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const role = symbolRole(request);
  return createMt5EventStream({
    request,
    eventName: "symbol-snapshot",
    snapshot: () => buildSymbolSyncResponse(role)
  });
}

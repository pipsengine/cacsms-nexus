import { createMt5EventStream } from "../../_lib/realtime-stream";
import { buildOrderRouterResponse, orderRouterRole } from "../_lib/store";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const role = orderRouterRole(request);
  return createMt5EventStream({
    request,
    eventName: "router-snapshot",
    snapshot: () => buildOrderRouterResponse(role)
  });
}

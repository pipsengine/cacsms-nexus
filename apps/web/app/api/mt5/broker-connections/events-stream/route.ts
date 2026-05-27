import { createMt5EventStream } from "../../_lib/realtime-stream";
import { brokerRole, buildBrokerConnectionsResponse } from "../_lib/store";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const role = brokerRole(request);
  return createMt5EventStream({
    request,
    eventName: "broker-snapshot",
    snapshot: () => buildBrokerConnectionsResponse(role)
  });
}

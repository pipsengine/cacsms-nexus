import { ok } from "../_lib/http";
import { brokerRole, buildBrokerConnectionsResponse } from "./_lib/store";

export function GET(request: Request) {
  return ok(buildBrokerConnectionsResponse(brokerRole(request)));
}

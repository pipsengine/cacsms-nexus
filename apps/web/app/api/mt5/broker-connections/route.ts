import { ok } from "../_lib/http";
import { withMt5Module } from "../_lib/ensure-ready";
import { brokerRole, buildBrokerConnectionsResponse } from "./_lib/store";

export async function GET(request: Request) {
  return ok(await withMt5Module("broker-connections", () => buildBrokerConnectionsResponse(brokerRole(request))));
}

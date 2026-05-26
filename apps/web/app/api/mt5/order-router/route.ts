import { ensureMt5Ready } from "../_lib/ensure-ready";
import { ok } from "../_lib/http";
import { buildOrderRouterResponse, orderRouterRole } from "./_lib/store";

export async function GET(request: Request) {
  await ensureMt5Ready("order-router");
  return ok(buildOrderRouterResponse(orderRouterRole(request)));
}

import { ok } from "../_lib/http";
import { buildOrderRouterResponse, orderRouterRole } from "./_lib/store";

export function GET(request: Request) { return ok(buildOrderRouterResponse(orderRouterRole(request))); }

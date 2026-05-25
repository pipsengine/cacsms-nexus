import { ok } from "../../_lib/http";
import { orderRouterRole, routerSummary } from "../_lib/store";

export function GET(request: Request) { return ok(routerSummary(orderRouterRole(request))); }

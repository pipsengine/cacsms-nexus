import { failure, ok } from "../../_lib/http";
import { orderRouterRole, setRoutingPaused } from "../_lib/store";

export async function POST(request: Request) {
  try { const body = (await request.json()) as { confirmed?: boolean }; return ok(setRoutingPaused(true, orderRouterRole(request), Boolean(body.confirmed), request)); } catch (error) { return failure(error); }
}

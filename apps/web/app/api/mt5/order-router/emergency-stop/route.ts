import { failure, ok } from "../../_lib/http";
import { emergencyStopRouting, orderRouterRole } from "../_lib/store";

export async function POST(request: Request) {
  try { const body = (await request.json()) as { confirmed?: boolean }; return ok(emergencyStopRouting(orderRouterRole(request), Boolean(body.confirmed), request)); } catch (error) { return failure(error); }
}

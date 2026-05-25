import { failure, ok } from "../../../../_lib/http";
import { orderRouterRole, retryRoute } from "../../../_lib/store";

export async function POST(request: Request, context: { params: Promise<{ routeId: string }> }) {
  try { const body = (await request.json()) as { confirmed?: boolean }; return ok(retryRoute((await context.params).routeId, orderRouterRole(request), Boolean(body.confirmed), request)); } catch (error) { return failure(error); }
}

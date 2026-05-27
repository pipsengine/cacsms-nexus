import { failure, ok } from "../../../../_lib/http";
import { withMt5Modules } from "../../../../_lib/ensure-ready";
import { dispatchRouteToEa, orderRouterRole } from "../../../_lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ routeId: string }> }) {
  try {
    const body = (await request.json()) as { confirmed?: boolean };
    const routeId = (await context.params).routeId;
    return ok(
      await withMt5Modules(["order-router", "ea-bridge"], () =>
        dispatchRouteToEa(routeId, orderRouterRole(request), Boolean(body.confirmed), request)
      ),
      202
    );
  } catch (error) {
    return failure(error);
  }
}

import { failure, ok } from "../../_lib/http";
import { autoRemediateRouter, orderRouterRole } from "../_lib/store";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { diagnosticId?: string; confirmed?: boolean };
    if (!body.diagnosticId) throw new Error("diagnosticId is required.");
    return ok(autoRemediateRouter(body.diagnosticId, orderRouterRole(request), Boolean(body.confirmed), request));
  } catch (error) { return failure(error); }
}

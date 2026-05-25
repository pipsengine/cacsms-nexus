import { failure, ok } from "../../_lib/http";
import { orderRouterRole, runRouterDiagnostics } from "../_lib/store";

export async function POST(request: Request) {
  try { const body = (await request.json()) as { confirmed?: boolean }; return ok(runRouterDiagnostics(orderRouterRole(request), Boolean(body.confirmed), request)); } catch (error) { return failure(error); }
}

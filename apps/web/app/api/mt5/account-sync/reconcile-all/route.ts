import { failure, ok } from "../../_lib/http";
import { accountRole, reconcileAll } from "../_lib/store";

export async function POST(request: Request) {
  try { const body = (await request.json()) as { confirmed?: boolean }; return ok(reconcileAll(accountRole(request), Boolean(body.confirmed), request)); } catch (error) { return failure(error); }
}

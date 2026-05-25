import { failure, ok } from "../../../../_lib/http";
import { accountRole, syncAccount } from "../../../_lib/store";

export async function POST(request: Request, context: { params: Promise<{ accountId: string }> }) {
  try { const body = (await request.json()) as { confirmed?: boolean }; return ok(syncAccount((await context.params).accountId, accountRole(request), Boolean(body.confirmed), request)); } catch (error) { return failure(error); }
}

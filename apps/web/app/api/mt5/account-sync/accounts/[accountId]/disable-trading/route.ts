import { failure, ok } from "../../../../_lib/http";
import { accountRole, setAccountTrading } from "../../../_lib/store";

export async function POST(request: Request, context: { params: Promise<{ accountId: string }> }) {
  try { const body = (await request.json()) as { confirmed?: boolean }; return ok(setAccountTrading((await context.params).accountId, false, accountRole(request), Boolean(body.confirmed), request)); } catch (error) { return failure(error); }
}

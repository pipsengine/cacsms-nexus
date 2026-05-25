import { failure, ok } from "../../_lib/http";
import { accountRole, syncSelectedAccounts } from "../_lib/store";

export async function POST(request: Request) {
  try { const body = (await request.json()) as { accountIds?: string[]; confirmed?: boolean }; return ok(syncSelectedAccounts(body.accountIds ?? [], accountRole(request), Boolean(body.confirmed), request)); } catch (error) { return failure(error); }
}

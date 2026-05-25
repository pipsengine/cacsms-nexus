import { failure, ok } from "../../_lib/http";
import { getRole, syncAllAccounts } from "../../_lib/store";

export function POST(request: Request) {
  try { return ok(syncAllAccounts(getRole(request), request)); } catch (error) { return failure(error); }
}

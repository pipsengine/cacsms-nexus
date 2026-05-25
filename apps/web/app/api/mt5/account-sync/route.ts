import { ok } from "../_lib/http";
import { accountRole, buildAccountSyncResponse } from "./_lib/store";

export function GET(request: Request) { return ok(buildAccountSyncResponse(accountRole(request))); }

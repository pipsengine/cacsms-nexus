import { ok } from "../_lib/http";
import { withMt5Module } from "../_lib/ensure-ready";
import { accountRole, buildAccountSyncResponse } from "./_lib/store";

export async function GET(request: Request) {
  return ok(await withMt5Module("account-sync", () => buildAccountSyncResponse(accountRole(request))));
}

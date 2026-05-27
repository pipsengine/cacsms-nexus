import { createMt5EventStream } from "../../_lib/realtime-stream";
import { accountRole, buildAccountSyncResponse } from "../_lib/store";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const role = accountRole(request);
  return createMt5EventStream({
    request,
    eventName: "account-snapshot",
    snapshot: () => buildAccountSyncResponse(role)
  });
}

import { createMt5EventStream } from "../../_lib/realtime-stream";
import { withEaBridgeStore } from "../_lib/handler";
import { buildEaBridgeResponse, eaBridgeRole } from "../_lib/store";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const role = eaBridgeRole(request);
  return createMt5EventStream({
    request,
    eventName: "bridge-snapshot",
    snapshot: () => withEaBridgeStore(() => buildEaBridgeResponse(role))
  });
}

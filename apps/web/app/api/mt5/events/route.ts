import { ensureMt5Ready } from "../_lib/ensure-ready";
import { createMt5EventStream } from "../_lib/realtime-stream";
import { buildControlCenter, getRole } from "../_lib/store";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await ensureMt5Ready("mt5-control-center");
  const role = getRole(request);
  return createMt5EventStream({
    request,
    eventName: "snapshot",
    snapshot: () => buildControlCenter(role)
  });
}

import { createMt5EventStream } from "../../_lib/realtime-stream";
import { buildTerminalStatusResponse, terminalStatusRole } from "../_lib/store";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const role = terminalStatusRole(request);
  return createMt5EventStream({
    request,
    eventName: "terminal-snapshot",
    snapshot: () => buildTerminalStatusResponse(role)
  });
}

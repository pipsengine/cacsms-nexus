import { createMt5EventStream } from "../../_lib/realtime-stream";
import { buildChartTemplatesResponse, templateRole } from "../_lib/store";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const role = templateRole(request);
  return createMt5EventStream({
    request,
    eventName: "template-snapshot",
    snapshot: () => buildChartTemplatesResponse(role)
  });
}

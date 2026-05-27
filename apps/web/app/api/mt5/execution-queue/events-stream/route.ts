import { createMt5EventStream } from "../../_lib/realtime-stream";
import { buildSummary, executionQueueRole, listItems } from "../_lib/store";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const role = executionQueueRole(request);
  return createMt5EventStream({
    request,
    eventName: "queue-snapshot",
    snapshot: () => ({
      summary: buildSummary(role),
      items: listItems({ page: 1, pageSize: 60, status: "all", priority: "all" })
    })
  });
}

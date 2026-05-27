import { createMt5EventStream } from "../../_lib/realtime-stream";
import { buildChartControlResponse, chartRole } from "../_lib/store";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const role = chartRole(request);
  return createMt5EventStream({
    request,
    eventName: "chart-snapshot",
    snapshot: () => buildChartControlResponse(role)
  });
}

import { ok } from "../_lib/http";
import { buildChartControlResponse, chartRole } from "./_lib/store";

export function GET(request: Request) {
  return ok(buildChartControlResponse(chartRole(request)));
}

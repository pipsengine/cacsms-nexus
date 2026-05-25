import { ok } from "../_lib/http";
import { buildChartTemplatesResponse, templateRole } from "./_lib/store";

export function GET(request: Request) {
  return ok(buildChartTemplatesResponse(templateRole(request)));
}

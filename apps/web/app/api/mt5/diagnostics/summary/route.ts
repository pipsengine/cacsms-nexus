import { ok } from "../../_lib/http";
import { buildControlCenter, getRole } from "../../_lib/store";

export function GET(request: Request) {
  const dashboard = buildControlCenter(getRole(request));
  return ok({ connectionHealth: dashboard.connectionHealth, openIncidents: dashboard.incidents.length, diagnostics: dashboard.diagnostics });
}

import { ok } from "../../_lib/http";
import { buildSymbolSyncResponse, symbolRole } from "../_lib/store";

export function GET(request: Request) {
  const response = buildSymbolSyncResponse(symbolRole(request));
  return ok({ meta: response.meta, kpis: response.kpis, health: response.health, workflow: response.workflow, permissions: response.permissions });
}

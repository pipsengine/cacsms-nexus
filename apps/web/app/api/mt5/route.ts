import { ok } from "./_lib/http";
import { withMt5Module } from "./_lib/ensure-ready";
import { buildControlCenter, getRole } from "./_lib/store";

export async function GET(request: Request) {
  return ok(await withMt5Module("mt5-control-center", () => buildControlCenter(getRole(request))));
}

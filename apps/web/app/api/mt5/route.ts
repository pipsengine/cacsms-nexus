import { ok } from "./_lib/http";
import { buildControlCenter, getRole } from "./_lib/store";

export function GET(request: Request) {
  return ok(buildControlCenter(getRole(request)));
}

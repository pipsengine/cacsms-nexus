import { ok } from "../../_lib/http";
import { withEaBridgeStore } from "../_lib/handler";
import { bridgeSummary, eaBridgeRole } from "../_lib/store";

export async function GET(request: Request) {
  return ok(await withEaBridgeStore(() => bridgeSummary(eaBridgeRole(request))));
}

import { ok } from "../../_lib/http";
import { bridgeSummary, eaBridgeRole } from "../_lib/store";

export function GET(request: Request) {
  return ok(bridgeSummary(eaBridgeRole(request)));
}

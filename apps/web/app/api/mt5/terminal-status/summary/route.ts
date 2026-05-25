import { ok } from "../../_lib/http";
import { terminalStatusRole, terminalSummary } from "../_lib/store";

export function GET(request: Request) {
  return ok(terminalSummary(terminalStatusRole(request)));
}

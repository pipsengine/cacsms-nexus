import { ok } from "../_lib/http";
import { buildTerminalStatusResponse, terminalStatusRole } from "./_lib/store";

export function GET(request: Request) {
  return ok(buildTerminalStatusResponse(terminalStatusRole(request)));
}

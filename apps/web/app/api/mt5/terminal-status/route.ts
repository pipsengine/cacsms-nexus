import { ok } from "../_lib/http";
import { withMt5Module } from "../_lib/ensure-ready";
import { buildTerminalStatusResponse, terminalStatusRole } from "./_lib/store";

export async function GET(request: Request) {
  return ok(await withMt5Module("terminal-status", () => buildTerminalStatusResponse(terminalStatusRole(request))));
}

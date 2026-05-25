import { ok } from "../../_lib/http";
import { terminalDiagnostics } from "../_lib/store";

export function GET() {
  return ok(terminalDiagnostics());
}

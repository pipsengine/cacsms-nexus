import { ok } from "../../_lib/http";
import { diagnostics } from "../_lib/store";

export function GET() {
  return ok(diagnostics());
}

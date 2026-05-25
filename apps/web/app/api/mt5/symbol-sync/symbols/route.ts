import { ok } from "../../_lib/http";
import { symbols } from "../_lib/store";

export function GET() {
  return ok(symbols());
}

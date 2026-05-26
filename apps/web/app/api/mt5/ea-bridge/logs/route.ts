import { ok } from "../../_lib/http";
import { withEaBridgeStore } from "../_lib/handler";
import { bridgeLogs } from "../_lib/store";

export async function GET() {
  return ok(await withEaBridgeStore(() => bridgeLogs()));
}

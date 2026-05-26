import { ok } from "../../_lib/http";
import { withEaBridgeStore } from "../_lib/handler";
import { publicBridgeInstances } from "../_lib/store";

export async function GET() {
  return ok(await withEaBridgeStore(() => publicBridgeInstances()));
}

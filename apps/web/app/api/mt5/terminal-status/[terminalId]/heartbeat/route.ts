import { ok } from "../../../_lib/http";
import { terminalHeartbeats } from "../../_lib/store";

export async function GET(_: Request, context: { params: Promise<{ terminalId: string }> }) {
  return ok(terminalHeartbeats((await context.params).terminalId));
}

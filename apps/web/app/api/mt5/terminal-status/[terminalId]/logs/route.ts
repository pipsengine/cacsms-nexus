import { ok } from "../../../_lib/http";
import { terminalLogs } from "../../_lib/store";

export async function GET(_: Request, context: { params: Promise<{ terminalId: string }> }) {
  return ok(terminalLogs((await context.params).terminalId));
}

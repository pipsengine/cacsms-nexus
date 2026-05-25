import { ok } from "../../../_lib/http";
import { terminalEvents } from "../../_lib/store";

export async function GET(_: Request, context: { params: Promise<{ terminalId: string }> }) {
  return ok(terminalEvents((await context.params).terminalId));
}

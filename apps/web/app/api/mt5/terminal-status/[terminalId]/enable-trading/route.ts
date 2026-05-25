import { failure, ok } from "../../../_lib/http";
import { setTerminalTrading, terminalStatusRole } from "../../_lib/store";

export async function POST(request: Request, context: { params: Promise<{ terminalId: string }> }) {
  try {
    const body = (await request.json()) as { confirmed?: boolean };
    return ok(setTerminalTrading((await context.params).terminalId, true, terminalStatusRole(request), Boolean(body.confirmed), request));
  } catch (error) { return failure(error); }
}

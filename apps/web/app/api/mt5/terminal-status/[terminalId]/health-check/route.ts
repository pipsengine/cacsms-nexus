import { failure, ok } from "../../../_lib/http";
import { runTerminalHealthCheck, terminalStatusRole } from "../../_lib/store";

export async function POST(request: Request, context: { params: Promise<{ terminalId: string }> }) {
  try {
    const body = (await request.json()) as { confirmed?: boolean };
    return ok(runTerminalHealthCheck((await context.params).terminalId, terminalStatusRole(request), Boolean(body.confirmed), request));
  } catch (error) { return failure(error); }
}

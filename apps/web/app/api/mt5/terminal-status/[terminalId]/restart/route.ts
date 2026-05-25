import { failure, ok } from "../../../_lib/http";
import { restartTerminalStatus, terminalStatusRole } from "../../_lib/store";

export async function POST(request: Request, context: { params: Promise<{ terminalId: string }> }) {
  try {
    const body = (await request.json()) as { confirmed?: boolean; override?: boolean };
    return ok(restartTerminalStatus((await context.params).terminalId, terminalStatusRole(request), Boolean(body.confirmed), Boolean(body.override), request));
  } catch (error) { return failure(error); }
}

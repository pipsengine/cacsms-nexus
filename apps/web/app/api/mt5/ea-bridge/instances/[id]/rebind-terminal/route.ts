import { failure, ok } from "../../../../_lib/http";
import { eaBridgeRole, rebindTerminal } from "../../../_lib/store";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const body = (await request.json()) as { terminalName?: string; confirmed?: boolean };
    if (!body.terminalName) throw new Error("terminalName is required.");
    return ok(rebindTerminal((await context.params).id, body.terminalName, eaBridgeRole(request), Boolean(body.confirmed), request));
  } catch (error) { return failure(error); }
}

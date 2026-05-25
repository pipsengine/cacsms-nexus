import { failure, ok } from "../../_lib/http";
import { autoRemediateTerminal, terminalStatusRole } from "../_lib/store";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { diagnosticId?: string; confirmed?: boolean };
    if (!body.diagnosticId) throw new Error("diagnosticId is required.");
    return ok(autoRemediateTerminal(body.diagnosticId, terminalStatusRole(request), Boolean(body.confirmed), request));
  } catch (error) { return failure(error); }
}

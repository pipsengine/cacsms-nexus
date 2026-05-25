import { failure, ok } from "../../../_lib/http";
import { disableTerminal, getRole, restartTerminal, updateTerminal } from "../../../_lib/store";

export async function POST(request: Request, context: { params: Promise<{ id: string; action: string }> }) {
  try {
    const { id, action } = await context.params;
    if (action === "restart") return ok(restartTerminal(id, getRole(request), request));
    if (action === "disable") return ok(disableTerminal(id, getRole(request), request));
    throw new Error("Unsupported terminal action.");
  } catch (error) { return failure(error); }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string; action: string }> }) {
  try {
    const { id, action } = await context.params;
    if (action !== "update") throw new Error("Unsupported terminal action.");
    return ok(updateTerminal(id, await request.json(), getRole(request), request));
  } catch (error) { return failure(error); }
}

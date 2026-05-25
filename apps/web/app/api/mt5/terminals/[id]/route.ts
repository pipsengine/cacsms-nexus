import { failure, ok } from "../../_lib/http";
import { deleteTerminal, getRole, getTerminal, updateTerminal } from "../../_lib/store";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const terminal = getTerminal((await context.params).id);
  return terminal ? ok(terminal) : failure(new Error("MT5 terminal not found."));
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try { return ok(updateTerminal((await context.params).id, await request.json(), getRole(request), request)); } catch (error) { return failure(error); }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try { return ok(deleteTerminal((await context.params).id, getRole(request), request)); } catch (error) { return failure(error); }
}

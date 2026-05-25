import { failure, ok } from "../../../_lib/http";
import { getRole, updateSymbolMapping } from "../../../_lib/store";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try { return ok(updateSymbolMapping((await context.params).id, await request.json(), getRole(request), request)); } catch (error) { return failure(error); }
}

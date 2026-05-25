import { failure, ok } from "../../../../_lib/http";
import { remapSymbol, symbolRole } from "../../../_lib/store";

export async function PATCH(request: Request, context: { params: Promise<{ symbolId: string }> }) {
  try {
    const body = (await request.json()) as { normalizedSymbol?: string; confirmed?: boolean };
    if (!body.normalizedSymbol) throw new Error("Normalized symbol is required.");
    return ok(remapSymbol((await context.params).symbolId, body.normalizedSymbol, symbolRole(request), Boolean(body.confirmed), request));
  } catch (error) { return failure(error); }
}

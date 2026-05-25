import { failure, ok } from "../../../../_lib/http";
import { symbolRole, validateMapping } from "../../../_lib/store";

export async function POST(request: Request, context: { params: Promise<{ symbolId: string }> }) {
  try {
    const body = (await request.json()) as { confirmed?: boolean };
    return ok(validateMapping((await context.params).symbolId, symbolRole(request), Boolean(body.confirmed), request));
  } catch (error) { return failure(error); }
}

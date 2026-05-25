import { failure, ok } from "../../../../_lib/http";
import { eaBridgeRole, setBridgeTrading } from "../../../_lib/store";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const body = (await request.json()) as { confirmed?: boolean };
    return ok(setBridgeTrading((await context.params).id, true, eaBridgeRole(request), Boolean(body.confirmed), request));
  } catch (error) { return failure(error); }
}

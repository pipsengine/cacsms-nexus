import { failure, ok } from "../../../_lib/http";
import { configureBroker, getRole, testBroker } from "../../../_lib/store";

export async function POST(request: Request, context: { params: Promise<{ id: string; action: string }> }) {
  try {
    const { id, action } = await context.params;
    if (action !== "test-connection") throw new Error("Unsupported broker action.");
    return ok(testBroker(id, getRole(request), request));
  } catch (error) { return failure(error); }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string; action: string }> }) {
  try {
    const { id, action } = await context.params;
    if (action !== "configuration") throw new Error("Unsupported broker action.");
    return ok(configureBroker(id, await request.json(), getRole(request), request));
  } catch (error) { return failure(error); }
}

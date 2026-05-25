import { failure, ok } from "../../../../_lib/http";
import { eaBridgeRole, rotateBridgeToken } from "../../../_lib/store";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const body = (await request.json()) as { confirmed?: boolean };
    return ok(rotateBridgeToken((await context.params).id, eaBridgeRole(request), Boolean(body.confirmed), request));
  } catch (error) { return failure(error); }
}

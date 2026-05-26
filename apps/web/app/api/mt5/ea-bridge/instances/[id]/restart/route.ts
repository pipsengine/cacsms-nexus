import { failure, ok } from "../../../../_lib/http";
import { withEaBridgeStore } from "../../../_lib/handler";
import { eaBridgeRole, restartBridgeSession } from "../../../_lib/store";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const body = (await request.json()) as { confirmed?: boolean };
    const id = (await context.params).id;
    return ok(await withEaBridgeStore(() =>
      restartBridgeSession(id, eaBridgeRole(request), Boolean(body.confirmed), request)
    ));
  } catch (error) {
    return failure(error);
  }
}

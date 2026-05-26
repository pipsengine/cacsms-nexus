import { failure, ok } from "../../../../_lib/http";
import { withEaBridgeStore } from "../../../_lib/handler";
import { eaBridgeRole, setBridgeTrading } from "../../../_lib/store";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const body = (await request.json()) as { confirmed?: boolean };
    const id = (await context.params).id;
    return ok(await withEaBridgeStore(() =>
      setBridgeTrading(id, true, eaBridgeRole(request), Boolean(body.confirmed), request)
    ));
  } catch (error) {
    return failure(error);
  }
}

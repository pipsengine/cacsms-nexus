import { failure, ok } from "../../../../_lib/http";
import { withEaBridgeStore } from "../../../_lib/handler";
import { pendingTradeCommands } from "../../../_lib/store";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const id = (await context.params).id;
    const envelope = await request.json();
    return ok(await withEaBridgeStore(() => pendingTradeCommands(id, envelope, request)));
  } catch (error) {
    return failure(error);
  }
}

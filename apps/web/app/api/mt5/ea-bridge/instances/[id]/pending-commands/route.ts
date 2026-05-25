import { failure, ok } from "../../../../_lib/http";
import { pendingTradeCommands } from "../../../_lib/store";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    return ok(pendingTradeCommands((await context.params).id, await request.json(), request));
  } catch (error) {
    return failure(error);
  }
}

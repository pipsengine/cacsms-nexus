import { failure, ok } from "../../../_lib/http";
import { withEaBridgeStore } from "../../_lib/handler";
import { publicBridgeInstance } from "../../_lib/store";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const id = (await context.params).id;
    return ok(await withEaBridgeStore(() => publicBridgeInstance(id)));
  } catch (error) {
    return failure(error);
  }
}

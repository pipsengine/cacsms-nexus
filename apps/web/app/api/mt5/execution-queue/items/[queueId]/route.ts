import { failure, ok } from "../../../_lib/http";
import { itemDetail } from "../../_lib/store";

export function GET(_request: Request, context: { params: Promise<{ queueId: string }> }) {
  return context.params.then(({ queueId }) => {
    try {
      return ok(itemDetail(queueId));
    } catch (e) {
      return failure(e);
    }
  });
}


import { failure, ok } from "../../../../_lib/http";
import { executionQueueRole, retryItem } from "../../../_lib/store";

export function POST(request: Request, context: { params: Promise<{ queueId: string }> }) {
  return context.params.then(({ queueId }) => {
    try {
      return ok(retryItem(queueId, executionQueueRole(request), request));
    } catch (e) {
      return failure(e);
    }
  });
}


import { failure, ok } from "../../../../_lib/http";
import { cancelItem, executionQueueRole } from "../../../_lib/store";

export function POST(request: Request, context: { params: Promise<{ queueId: string }> }) {
  return context.params.then(({ queueId }) => {
    try {
      return ok(cancelItem(queueId, executionQueueRole(request), request));
    } catch (e) {
      return failure(e);
    }
  });
}


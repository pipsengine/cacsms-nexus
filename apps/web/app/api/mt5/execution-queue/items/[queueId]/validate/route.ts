import { failure, ok } from "../../../../_lib/http";
import { executionQueueRole, validateItem } from "../../../_lib/store";

export function POST(request: Request, context: { params: Promise<{ queueId: string }> }) {
  return context.params.then(({ queueId }) => {
    try {
      return ok(validateItem(queueId, executionQueueRole(request), request));
    } catch (e) {
      return failure(e);
    }
  });
}


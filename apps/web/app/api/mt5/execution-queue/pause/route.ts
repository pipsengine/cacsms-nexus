import { failure, ok } from "../../_lib/http";
import { executionQueueRole, pauseQueue } from "../_lib/store";

export function POST(request: Request) {
  try {
    return ok(pauseQueue(executionQueueRole(request), request));
  } catch (e) {
    return failure(e);
  }
}


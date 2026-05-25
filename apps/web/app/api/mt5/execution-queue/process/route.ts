import { failure, ok } from "../../_lib/http";
import { executionQueueRole, processQueue } from "../_lib/store";

export function POST(request: Request) {
  try {
    return ok(processQueue(executionQueueRole(request), request));
  } catch (e) {
    return failure(e);
  }
}


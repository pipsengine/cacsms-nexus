import { failure, ok } from "../../_lib/http";
import { executionQueueRole, resumeQueue } from "../_lib/store";

export function POST(request: Request) {
  try {
    return ok(resumeQueue(executionQueueRole(request), request));
  } catch (e) {
    return failure(e);
  }
}


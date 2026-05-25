import { failure, ok } from "../../_lib/http";
import { autoRemediate, executionQueueRole } from "../_lib/store";

export function POST(request: Request) {
  try {
    return ok(autoRemediate(executionQueueRole(request), request));
  } catch (e) {
    return failure(e);
  }
}


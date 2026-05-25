import { failure, ok } from "../../_lib/http";
import { emergencyStop, executionQueueRole } from "../_lib/store";

export function POST(request: Request) {
  try {
    return ok(emergencyStop(executionQueueRole(request), request));
  } catch (e) {
    return failure(e);
  }
}


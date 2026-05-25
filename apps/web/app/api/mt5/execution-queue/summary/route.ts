import { failure, ok } from "../../_lib/http";
import { buildSummary, executionQueueRole } from "../_lib/store";

export function GET(request: Request) {
  try {
    return ok(buildSummary(executionQueueRole(request)));
  } catch (e) {
    return failure(e);
  }
}


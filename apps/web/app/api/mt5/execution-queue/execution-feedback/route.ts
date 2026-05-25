import { failure, ok } from "../../_lib/http";
import { executionFeedback } from "../_lib/store";

export function GET() {
  try {
    return ok(executionFeedback());
  } catch (e) {
    return failure(e);
  }
}


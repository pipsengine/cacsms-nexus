import { failure, ok } from "../../_lib/http";
import { bottlenecks } from "../_lib/store";

export function GET() {
  try {
    return ok(bottlenecks());
  } catch (e) {
    return failure(e);
  }
}


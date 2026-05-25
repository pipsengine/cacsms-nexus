import { failure, ok } from "../../_lib/http";
import { logs } from "../_lib/store";

export function GET() {
  try {
    return ok(logs());
  } catch (e) {
    return failure(e);
  }
}


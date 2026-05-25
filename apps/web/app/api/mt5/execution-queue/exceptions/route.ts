import { failure, ok } from "../../_lib/http";
import { exceptions } from "../_lib/store";

export function GET() {
  try {
    return ok(exceptions());
  } catch (e) {
    return failure(e);
  }
}


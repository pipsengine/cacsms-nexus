import { failure, ok } from "../../_lib/http";
import { prioritySla } from "../_lib/store";

export function GET() {
  try {
    return ok(prioritySla());
  } catch (e) {
    return failure(e);
  }
}


import { failure, ok } from "../../_lib/http";
import { aiDiagnostics } from "../_lib/store";

export function GET() {
  try {
    return ok(aiDiagnostics());
  } catch (e) {
    return failure(e);
  }
}


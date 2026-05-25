import { failure, ok } from "../../_lib/http";
import { getRole, runDiagnostics } from "../../_lib/store";

export function POST(request: Request) {
  try { return ok(runDiagnostics(getRole(request), request)); } catch (error) { return failure(error); }
}

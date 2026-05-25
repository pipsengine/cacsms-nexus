import { failure, ok } from "../../_lib/http";
import { getRole, syncSymbols } from "../../_lib/store";

export function POST(request: Request) {
  try { return ok(syncSymbols(getRole(request), request)); } catch (error) { return failure(error); }
}

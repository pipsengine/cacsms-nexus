import { failure, ok } from "../../_lib/http";
import { getRole, syncBrokers } from "../../_lib/store";

export function POST(request: Request) {
  try { return ok(syncBrokers(getRole(request), request)); } catch (error) { return failure(error); }
}

import { failure, ok } from "../../_lib/http";
import { emergencyDisableTrading, getRole } from "../../_lib/store";

export function POST(request: Request) {
  try { return ok(emergencyDisableTrading(getRole(request), request)); } catch (error) { return failure(error); }
}

import { ok } from "../../_lib/http";
import { brokerRole, brokerSummary } from "../_lib/store";

export function GET(request: Request) {
  return ok(brokerSummary(brokerRole(request)));
}

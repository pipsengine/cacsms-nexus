import { ok } from "../../_lib/http";
import { accountRole, accountSummary } from "../_lib/store";

export function GET(request: Request) { return ok(accountSummary(accountRole(request))); }

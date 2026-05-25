import { ok } from "../_lib/http";
import { getAccounts } from "../_lib/store";

export function GET() { return ok(getAccounts()); }

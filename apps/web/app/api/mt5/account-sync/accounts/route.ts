import { ok } from "../../_lib/http";
import { accounts } from "../_lib/store";

export function GET() { return ok(accounts()); }

import { ok } from "../../_lib/http";
import { routerLogs } from "../_lib/store";

export function GET() { return ok(routerLogs()); }

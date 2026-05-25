import { ok } from "../../_lib/http";
import { syncLogs } from "../_lib/store";

export function GET() { return ok(syncLogs()); }

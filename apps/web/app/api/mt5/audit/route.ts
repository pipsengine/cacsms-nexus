import { ok } from "../_lib/http";
import { getAuditRecords } from "../_lib/store";

export function GET() { return ok(getAuditRecords()); }

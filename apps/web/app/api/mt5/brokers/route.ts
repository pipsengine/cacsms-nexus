import { ok } from "../_lib/http";
import { getBrokers } from "../_lib/store";

export function GET() { return ok(getBrokers()); }

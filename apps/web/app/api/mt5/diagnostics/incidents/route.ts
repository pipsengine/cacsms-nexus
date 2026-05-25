import { ok } from "../../_lib/http";
import { incidents } from "../../_lib/store";

export function GET() { return ok(incidents()); }

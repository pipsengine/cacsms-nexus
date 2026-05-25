import { ok } from "../../_lib/http";
import { exceptions } from "../_lib/store";

export function GET() { return ok(exceptions()); }

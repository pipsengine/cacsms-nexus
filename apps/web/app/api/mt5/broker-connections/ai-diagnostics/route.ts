import { ok } from "../../_lib/http";
import { brokerDiagnostics } from "../_lib/store";

export function GET() { return ok(brokerDiagnostics()); }

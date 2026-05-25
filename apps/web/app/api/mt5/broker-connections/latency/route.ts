import { ok } from "../../_lib/http";
import { brokerLatency } from "../_lib/store";

export function GET() { return ok(brokerLatency()); }

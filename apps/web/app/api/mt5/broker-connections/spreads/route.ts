import { ok } from "../../_lib/http";
import { brokerSpreads } from "../_lib/store";

export function GET() { return ok(brokerSpreads()); }

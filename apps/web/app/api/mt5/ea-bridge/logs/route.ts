import { ok } from "../../_lib/http";
import { bridgeLogs } from "../_lib/store";

export function GET() { return ok(bridgeLogs()); }

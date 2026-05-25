import { ok } from "../../_lib/http";
import { bridgeSessions } from "../_lib/store";

export function GET() { return ok(bridgeSessions()); }

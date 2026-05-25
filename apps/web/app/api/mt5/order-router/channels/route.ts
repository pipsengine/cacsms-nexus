import { ok } from "../../_lib/http";
import { channels } from "../_lib/store";

export function GET() { return ok(channels()); }

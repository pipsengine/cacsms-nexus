import { ok } from "../../_lib/http";
import { routes } from "../_lib/store";

export function GET() { return ok(routes()); }

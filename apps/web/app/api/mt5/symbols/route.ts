import { ok } from "../_lib/http";
import { getSymbols } from "../_lib/store";

export function GET() { return ok(getSymbols()); }

import { ok } from "../../_lib/http";
import { normalizeRequestedSymbols } from "../_lib/store";

export async function POST(request: Request) {
  const body = (await request.json()) as { symbols?: string[] };
  return ok(normalizeRequestedSymbols(body.symbols ?? []));
}

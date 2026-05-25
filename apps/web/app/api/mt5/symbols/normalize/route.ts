import { ok } from "../../_lib/http";
import { normalizeSymbol } from "@/modules/mt5-infrastructure-and-broker-connectivity/mt5-control-center/algorithms/mt5-control-center.algorithms";

export async function POST(request: Request) {
  const body = (await request.json()) as { symbols?: string[] };
  return ok((body.symbols ?? []).map((symbol) => ({ symbol, ...normalizeSymbol(symbol) })));
}

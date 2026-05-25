import { detectMarketDataGaps } from "@/modules/mt5-infrastructure-and-broker-connectivity/mt5-control-center/algorithms/mt5-control-center.algorithms";
import { ok } from "../_lib/http";
import { getSymbols } from "../_lib/store";

export function GET() {
  return ok(detectMarketDataGaps(getSymbols()));
}

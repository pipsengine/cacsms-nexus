import { ok } from "../_lib/http";
import { executionSamples } from "../_lib/store";

export function GET() {
  return ok(executionSamples().map((sample) => ({ brokerId: sample.brokerId, symbol: sample.symbol, slippagePoints: sample.slippagePoints, timestamp: sample.createdAt })));
}

import { calculateExecutionQuality } from "@/modules/mt5-infrastructure-and-broker-connectivity/mt5-control-center/algorithms/mt5-control-center.algorithms";
import { ok } from "../_lib/http";
import { executionSamples } from "../_lib/store";

export function GET() {
  return ok({ ...calculateExecutionQuality(executionSamples()), samples: executionSamples() });
}

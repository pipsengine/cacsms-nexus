import { ok } from "../_lib/http";
import { executionSamples } from "../_lib/store";

export function GET() {
  return ok(executionSamples().filter((sample) => sample.rejectionReason));
}

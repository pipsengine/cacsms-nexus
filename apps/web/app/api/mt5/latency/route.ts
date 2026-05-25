import { ok } from "../_lib/http";
import { getBrokers } from "../_lib/store";

export function GET() {
  return ok(getBrokers().map((broker) => ({ brokerId: broker.id, brokerName: broker.brokerName, latencyMs: broker.averageLatencyMs, status: broker.status })));
}

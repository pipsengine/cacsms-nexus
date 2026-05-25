import { failure, ok } from "../../../_lib/http";
import { getBroker } from "../../../_lib/store";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const broker = getBroker((await context.params).id);
  return broker ? ok({ id: broker.id, status: broker.status, averageLatencyMs: broker.averageLatencyMs, loginHealth: broker.loginHealth }) : failure(new Error("Broker not found."));
}

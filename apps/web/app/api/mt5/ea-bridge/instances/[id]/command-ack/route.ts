import type { SignedBridgeEnvelope } from "@/modules/mt5-infrastructure-and-broker-connectivity/ea-bridge/types/ea-bridge.types";
import { failure, ok } from "../../../../_lib/http";
import { acknowledgeTradeCommand } from "../../../_lib/store";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const envelope = (await request.json()) as SignedBridgeEnvelope;
    return ok(acknowledgeTradeCommand((await context.params).id, envelope, request), 202);
  } catch (error) {
    return failure(error);
  }
}

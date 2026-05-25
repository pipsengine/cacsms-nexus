import type { SignedBridgeEnvelope } from "@/modules/mt5-infrastructure-and-broker-connectivity/ea-bridge/types/ea-bridge.types";
import { failure, ok } from "../../../_lib/http";
import { acknowledgeTradeCommand } from "../../_lib/store";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SignedBridgeEnvelope;
    return ok(acknowledgeTradeCommand(body.instanceId, body, request), 202);
  } catch (error) {
    return failure(error);
  }
}

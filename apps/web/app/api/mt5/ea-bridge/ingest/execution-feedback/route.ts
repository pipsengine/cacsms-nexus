import type { SignedBridgeEnvelope } from "@/modules/mt5-infrastructure-and-broker-connectivity/ea-bridge/types/ea-bridge.types";
import { failure, ok } from "../../../_lib/http";
import { withEaBridgeStore } from "../../_lib/handler";
import { acknowledgeTradeCommand } from "../../_lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SignedBridgeEnvelope;
    const result = await withEaBridgeStore(() => acknowledgeTradeCommand(body.instanceId, body, request, body));
    return ok(result, 202);
  } catch (error) {
    return failure(error);
  }
}

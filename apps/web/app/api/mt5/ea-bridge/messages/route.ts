import type { SignedBridgeEnvelope } from "@/modules/mt5-infrastructure-and-broker-connectivity/ea-bridge/types/ea-bridge.types";
import { failure, ok } from "../../_lib/http";
import { withEaBridgeStore } from "../_lib/handler";
import { bridgeMessages, ingestSignedBridgeEvent } from "../_lib/store";

export async function GET() {
  return ok(await withEaBridgeStore(() => bridgeMessages()));
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SignedBridgeEnvelope;
    if (body.messageType === "Trade Execution Result" || body.messageType === "Command Poll") {
      throw new Error("Use the command-channel endpoint for this bridge message type.");
    }
    const result = await withEaBridgeStore(() => ingestSignedBridgeEvent(body, body.messageType, request));
    return ok(result, 202);
  } catch (error) {
    return failure(error);
  }
}

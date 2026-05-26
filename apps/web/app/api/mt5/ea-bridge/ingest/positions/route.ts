import type { SignedBridgeEnvelope } from "@/modules/mt5-infrastructure-and-broker-connectivity/ea-bridge/types/ea-bridge.types";
import { failure, ok } from "../../../_lib/http";
import { withEaBridgeStore } from "../../_lib/handler";
import { ingestSignedBridgeEvent } from "../../_lib/store";

export async function POST(request: Request) {
  try {
    const envelope = (await request.json()) as SignedBridgeEnvelope;
    const result = await withEaBridgeStore(() => ingestSignedBridgeEvent(envelope, "Position Update", request, envelope));
    return ok(result, 202);
  } catch (error) {
    return failure(error);
  }
}

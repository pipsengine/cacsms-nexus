import type { SignedBridgeEnvelope } from "@/modules/mt5-infrastructure-and-broker-connectivity/ea-bridge/types/ea-bridge.types";
import { failure, ok } from "../../../_lib/http";
import { ingestSignedBridgeEvent } from "../../_lib/store";

export async function POST(request: Request) {
  try {
    const result = ingestSignedBridgeEvent((await request.json()) as SignedBridgeEnvelope, "Pending Order Update", request);
    return ok(result, 202);
  } catch (error) {
    return failure(error);
  }
}

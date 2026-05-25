import type { TradeCommand } from "@/modules/mt5-infrastructure-and-broker-connectivity/ea-bridge/types/ea-bridge.types";
import { failure, ok } from "../../_lib/http";
import { bridgeCommands, eaBridgeRole, queueTradeCommand } from "../_lib/store";

export function GET() { return ok(bridgeCommands()); }

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as TradeCommand & { confirmed?: boolean };
    const result = queueTradeCommand(body, eaBridgeRole(request), Boolean(body.confirmed), request);
    return ok(result, result.accepted ? 202 : 409);
  } catch (error) { return failure(error); }
}

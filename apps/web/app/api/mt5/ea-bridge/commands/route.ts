import type { TradeCommand } from "@/modules/mt5-infrastructure-and-broker-connectivity/ea-bridge/types/ea-bridge.types";
import { failure, ok } from "../../_lib/http";
import { withEaBridgeStore } from "../_lib/handler";
import { bridgeCommands, eaBridgeRole, queueTradeCommand } from "../_lib/store";

export async function GET() {
  return ok(await withEaBridgeStore(() => bridgeCommands()));
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as TradeCommand & { confirmed?: boolean };
    const result = await withEaBridgeStore(() =>
      queueTradeCommand(body, eaBridgeRole(request), Boolean(body.confirmed), request)
    );
    return ok(result, result.accepted ? 202 : 409);
  } catch (error) {
    return failure(error);
  }
}

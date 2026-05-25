import { failure, ok } from "../../../_lib/http";
import { getRole, setTradingPermission, syncAccount } from "../../../_lib/store";

export async function POST(request: Request, context: { params: Promise<{ id: string; action: string }> }) {
  try {
    const { id, action } = await context.params;
    if (action !== "sync") throw new Error("Unsupported account action.");
    return ok(syncAccount(id, getRole(request), request));
  } catch (error) { return failure(error); }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string; action: string }> }) {
  try {
    const { id, action } = await context.params;
    if (action !== "trading-permission") throw new Error("Unsupported account action.");
    const body = (await request.json()) as { tradeAllowed?: boolean };
    if (typeof body.tradeAllowed !== "boolean") throw new Error("tradeAllowed must be a boolean.");
    return ok(setTradingPermission(id, body.tradeAllowed, getRole(request), request));
  } catch (error) { return failure(error); }
}

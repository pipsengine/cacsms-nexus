import { failure, ok } from "../../_lib/http";
import { orderRouterRole, submitTestOrderToEa } from "../_lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SubmitTestRequest = {
  confirmed?: boolean;
  eaInstanceId: string;
  symbol: string;
  volume: number;
  direction?: "Buy" | "Sell";
  orderType?: "Market" | "Limit";
  entryPrice?: number;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SubmitTestRequest;
    if (!body.eaInstanceId?.trim()) throw new Error("eaInstanceId is required.");
    if (!body.symbol?.trim()) throw new Error("symbol is required.");
    return ok(
      submitTestOrderToEa(
        {
          eaInstanceId: body.eaInstanceId.trim(),
          symbol: body.symbol.trim(),
          volume: body.volume,
          direction: body.direction,
          orderType: body.orderType,
          entryPrice: body.entryPrice
        },
        orderRouterRole(request),
        Boolean(body.confirmed),
        request
      ),
      202
    );
  } catch (error) {
    return failure(error);
  }
}

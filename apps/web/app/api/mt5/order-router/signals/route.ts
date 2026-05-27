import { failure, ok } from "../../_lib/http";
import { ingestStrategySignal, orderRouterRole } from "../_lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type StrategySignalRequest = {
  confirmed?: boolean;
  signalId?: string;
  strategyId?: string;
  strategyName?: string;
  sourceEngine?: string;
  accountLogin?: string;
  eaInstanceId?: string;
  symbol: string;
  direction: "Buy" | "Sell";
  orderType?: "Market" | "Limit" | "Stop";
  volume: number;
  entryPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  routingPriority?: "Critical" | "High" | "Normal";
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as StrategySignalRequest;
    if (!body.symbol?.trim()) throw new Error("symbol is required.");
    if (!body.direction) throw new Error("direction is required.");
    return ok(
      await ingestStrategySignal(
        {
          signalId: body.signalId,
          strategyId: body.strategyId,
          strategyName: body.strategyName,
          sourceEngine: body.sourceEngine,
          accountLogin: body.accountLogin,
          eaInstanceId: body.eaInstanceId,
          symbol: body.symbol.trim(),
          direction: body.direction,
          orderType: body.orderType,
          volume: body.volume,
          entryPrice: body.entryPrice,
          stopLoss: body.stopLoss,
          takeProfit: body.takeProfit,
          routingPriority: body.routingPriority
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

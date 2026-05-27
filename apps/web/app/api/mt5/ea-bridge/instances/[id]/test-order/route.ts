import { failure, ok } from "../../../../_lib/http";
import { withEaBridgeStore } from "../../../_lib/handler";
import { bridgeInstance, eaBridgeRole, queueTradeCommand, setBridgeTrading } from "../../../_lib/store";
import type { TradeCommand } from "@/modules/mt5-infrastructure-and-broker-connectivity/ea-bridge/types/ea-bridge.types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TestOrderRequest = {
  confirmed?: boolean;
  symbol?: string;
  direction?: "Buy" | "Sell";
  volume?: number;
  commandType?: "Market" | "Limit";
  requestedPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  enableTradingChannel?: boolean;
};

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const id = (await context.params).id;
    const body = (await request.json().catch(() => ({}))) as TestOrderRequest;
    if (!body.confirmed) throw new Error("Confirmation is required to send a test order.");

    return ok(await withEaBridgeStore(() => {
      const role = eaBridgeRole(request);
      const instance = bridgeInstance(id);

      if (body.enableTradingChannel) {
        setBridgeTrading(id, true, role, true, request);
      }

      const symbol = (body.symbol ?? instance.symbolScope?.[0] ?? "").trim();
      if (!symbol) {
        throw new Error("Provide a symbol (or configure EA symbol scope) before sending a test order.");
      }

      const now = new Date().toISOString();
      const commandUuid = `cmd-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const candidate: TradeCommand = {
        id: `ea-cmd-${commandUuid}`,
        commandUuid,
        eaInstanceId: instance.id,
        accountId: instance.accountId,
        accountLogin: instance.accountLogin,
        symbol,
        commandType: body.commandType ?? "Market",
        direction: body.direction ?? "Buy",
        volume: typeof body.volume === "number" && Number.isFinite(body.volume) ? body.volume : 0.01,
        requestedPrice: typeof body.requestedPrice === "number" && Number.isFinite(body.requestedPrice) ? body.requestedPrice : 0,
        stopLoss: typeof body.stopLoss === "number" && Number.isFinite(body.stopLoss) ? body.stopLoss : undefined,
        takeProfit: typeof body.takeProfit === "number" && Number.isFinite(body.takeProfit) ? body.takeProfit : undefined,
        riskApprovalStatus: "Approved",
        deliveryStatus: "Pending",
        executionStatus: "Pending",
        responseTimeMs: 0,
        rejectionReason: undefined,
        signalTimestamp: now,
        strategyId: "nexus-test-order",
        createdAt: now,
        executedAt: undefined
      };

      return queueTradeCommand(candidate, role, true, request);
    }), 202);
  } catch (error) {
    return failure(error);
  }
}

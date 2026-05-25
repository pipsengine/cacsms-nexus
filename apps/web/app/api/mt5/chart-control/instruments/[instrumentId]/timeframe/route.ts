import { failure, ok } from "../../../../_lib/http";
import { changeTimeframe, chartRole } from "../../../_lib/store";
import type { Timeframe } from "@/modules/mt5-infrastructure-and-broker-connectivity/chart-control/types/chart-control.types";

export async function POST(request: Request, context: { params: Promise<{ instrumentId: string }> }) {
  try {
    const body = (await request.json()) as { confirmed?: boolean; timeframe: Timeframe };
    return ok(changeTimeframe((await context.params).instrumentId, body.timeframe, chartRole(request), Boolean(body.confirmed), request));
  } catch (error) { return failure(error); }
}

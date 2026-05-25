import { failure, ok } from "../../../../_lib/http";
import { chartRole, toggleIndicator } from "../../../_lib/store";

export async function POST(request: Request, context: { params: Promise<{ instrumentId: string }> }) {
  try {
    const body = (await request.json()) as { confirmed?: boolean; indicator: string };
    return ok(toggleIndicator((await context.params).instrumentId, body.indicator, chartRole(request), Boolean(body.confirmed), request));
  } catch (error) { return failure(error); }
}

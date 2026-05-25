import { failure, ok } from "../../../../_lib/http";
import { captureSnapshot, chartRole } from "../../../_lib/store";

export async function POST(request: Request, context: { params: Promise<{ instrumentId: string }> }) {
  try {
    const body = (await request.json()) as { confirmed?: boolean; note?: string };
    return ok(captureSnapshot((await context.params).instrumentId, body.note ?? "", chartRole(request), Boolean(body.confirmed), request));
  } catch (error) { return failure(error); }
}

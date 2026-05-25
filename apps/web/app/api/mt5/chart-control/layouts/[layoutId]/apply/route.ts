import { failure, ok } from "../../../../_lib/http";
import { applyLayout, chartRole } from "../../../_lib/store";

export async function POST(request: Request, context: { params: Promise<{ layoutId: string }> }) {
  try {
    const body = (await request.json()) as { confirmed?: boolean };
    return ok(applyLayout((await context.params).layoutId, chartRole(request), Boolean(body.confirmed), request));
  } catch (error) { return failure(error); }
}

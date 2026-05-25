import { failure, ok } from "../../../../_lib/http";
import { marketRole, toggleWatchlist } from "../../../_lib/store";

export async function POST(request: Request, context: { params: Promise<{ instrumentId: string }> }) {
  try {
    const body = (await request.json()) as { confirmed?: boolean };
    return ok(toggleWatchlist((await context.params).instrumentId, marketRole(request), Boolean(body.confirmed), request));
  } catch (error) {
    return failure(error);
  }
}

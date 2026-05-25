import { failure, ok } from "../../../_lib/http";
import { symbol } from "../../_lib/store";

export async function GET(_request: Request, context: { params: Promise<{ symbolId: string }> }) {
  try { return ok(symbol((await context.params).symbolId)); } catch (error) { return failure(error); }
}

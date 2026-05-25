import { failure, ok } from "../../../_lib/http";
import { routeDetail } from "../../_lib/store";

export async function GET(_request: Request, context: { params: Promise<{ routeId: string }> }) {
  try { return ok(routeDetail((await context.params).routeId)); } catch (error) { return failure(error); }
}

import { failure, ok } from "../../../_lib/http";
import { publicBridgeInstance } from "../../_lib/store";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  try { return ok(publicBridgeInstance((await context.params).id)); } catch (error) { return failure(error); }
}

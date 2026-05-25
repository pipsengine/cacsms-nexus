import { failure, ok } from "../../_lib/http";
import { brokerConnection } from "../_lib/store";

export async function GET(_request: Request, context: { params: Promise<{ brokerId: string }> }) {
  try {
    return ok(brokerConnection((await context.params).brokerId));
  } catch (error) { return failure(error); }
}

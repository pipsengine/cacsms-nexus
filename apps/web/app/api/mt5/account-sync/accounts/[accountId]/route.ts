import { failure, ok } from "../../../_lib/http";
import { account } from "../../_lib/store";

export async function GET(_request: Request, context: { params: Promise<{ accountId: string }> }) {
  try { return ok(account((await context.params).accountId)); } catch (error) { return failure(error); }
}

import { failure, ok } from "../../../_lib/http";
import { getAccount } from "../../../_lib/store";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const account = getAccount((await context.params).id);
  return account ? ok(account) : failure(new Error("Account not found."));
}

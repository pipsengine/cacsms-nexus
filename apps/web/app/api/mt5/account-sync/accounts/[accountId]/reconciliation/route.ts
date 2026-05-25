import { ok } from "../../../../_lib/http";
import { reconciliation } from "../../../_lib/store";

export async function GET(_request: Request, context: { params: Promise<{ accountId: string }> }) { return ok(reconciliation((await context.params).accountId)); }

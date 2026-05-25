import { ok } from "../../../../_lib/http";
import { orders } from "../../../_lib/store";

export async function GET(_request: Request, context: { params: Promise<{ accountId: string }> }) { return ok(orders((await context.params).accountId)); }

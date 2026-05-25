import { ok } from "../../../../_lib/http";
import { positions } from "../../../_lib/store";

export async function GET(_request: Request, context: { params: Promise<{ accountId: string }> }) { return ok(positions((await context.params).accountId)); }

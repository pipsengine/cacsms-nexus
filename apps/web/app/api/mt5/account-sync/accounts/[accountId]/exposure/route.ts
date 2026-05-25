import { ok } from "../../../../_lib/http";
import { exposure } from "../../../_lib/store";

export async function GET(_request: Request, context: { params: Promise<{ accountId: string }> }) { return ok(exposure((await context.params).accountId)); }

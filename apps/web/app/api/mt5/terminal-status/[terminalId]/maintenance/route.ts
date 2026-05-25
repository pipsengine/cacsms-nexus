import { failure, ok } from "../../../_lib/http";
import { setMaintenance, terminalStatusRole } from "../../_lib/store";

export async function POST(request: Request, context: { params: Promise<{ terminalId: string }> }) {
  try {
    const body = (await request.json()) as { enabled?: boolean; confirmed?: boolean };
    return ok(setMaintenance((await context.params).terminalId, body.enabled !== false, terminalStatusRole(request), Boolean(body.confirmed), request));
  } catch (error) { return failure(error); }
}

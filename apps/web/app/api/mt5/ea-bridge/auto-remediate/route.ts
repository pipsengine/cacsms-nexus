import { failure, ok } from "../../_lib/http";
import { autoRemediateBridge, eaBridgeRole } from "../_lib/store";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { diagnosticId?: string; confirmed?: boolean };
    if (!body.diagnosticId) throw new Error("diagnosticId is required.");
    return ok(autoRemediateBridge(body.diagnosticId, eaBridgeRole(request), Boolean(body.confirmed), request));
  } catch (error) { return failure(error); }
}

import { failure, ok } from "../../_lib/http";
import { autoRemediate, getRole } from "../../_lib/store";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { diagnosticId?: string };
    if (!body.diagnosticId) throw new Error("diagnosticId is required.");
    return ok(autoRemediate(body.diagnosticId, getRole(request), request));
  } catch (error) { return failure(error); }
}

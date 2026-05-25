import { failure, ok } from "../../_lib/http";
import { autoRemediateSymbol, symbolRole } from "../_lib/store";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { diagnosticId?: string; confirmed?: boolean };
    if (!body.diagnosticId) throw new Error("Symbol diagnostic ID is required.");
    return ok(autoRemediateSymbol(body.diagnosticId, symbolRole(request), Boolean(body.confirmed), request));
  } catch (error) { return failure(error); }
}

import { failure, ok } from "../../_lib/http";
import { runSymbolDiagnostics, symbolRole } from "../_lib/store";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { confirmed?: boolean };
    return ok(runSymbolDiagnostics(symbolRole(request), Boolean(body.confirmed), request));
  } catch (error) { return failure(error); }
}

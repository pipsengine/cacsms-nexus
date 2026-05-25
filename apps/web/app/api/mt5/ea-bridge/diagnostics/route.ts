import { failure, ok } from "../../_lib/http";
import { bridgeDiagnostics, eaBridgeRole, runBridgeDiagnostics } from "../_lib/store";

export function GET() { return ok(bridgeDiagnostics()); }
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { confirmed?: boolean };
    return ok(runBridgeDiagnostics(null, eaBridgeRole(request), Boolean(body.confirmed), request));
  } catch (error) { return failure(error); }
}

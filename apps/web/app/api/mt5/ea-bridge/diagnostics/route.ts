import { failure, ok } from "../../_lib/http";
import { withEaBridgeStore } from "../_lib/handler";
import { bridgeDiagnostics, eaBridgeRole, runBridgeDiagnostics } from "../_lib/store";

export async function GET() {
  return ok(await withEaBridgeStore(() => bridgeDiagnostics()));
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { confirmed?: boolean };
    return ok(await withEaBridgeStore(() =>
      runBridgeDiagnostics(null, eaBridgeRole(request), Boolean(body.confirmed), request)
    ));
  } catch (error) {
    return failure(error);
  }
}

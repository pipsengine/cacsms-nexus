import { failure, ok } from "../../_lib/http";
import { accountRole, diagnostics, runAccountDiagnostics } from "../_lib/store";

export function GET() { return ok(diagnostics()); }
export async function POST(request: Request) {
  try { const body = (await request.json()) as { accountId?: string; confirmed?: boolean }; return ok(runAccountDiagnostics(body.accountId ?? null, accountRole(request), Boolean(body.confirmed), request)); } catch (error) { return failure(error); }
}

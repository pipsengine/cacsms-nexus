import { failure, ok } from "../../_lib/http";
import { brokerRole, runBrokerDiagnostics } from "../_lib/store";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { brokerId?: string; confirmed?: boolean };
    return ok(runBrokerDiagnostics(body.brokerId ?? null, brokerRole(request), Boolean(body.confirmed), request));
  } catch (error) { return failure(error); }
}

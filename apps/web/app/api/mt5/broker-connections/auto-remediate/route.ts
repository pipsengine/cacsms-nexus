import { failure, ok } from "../../_lib/http";
import { autoRemediateBroker, brokerRole } from "../_lib/store";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { diagnosticId: string; confirmed?: boolean };
    return ok(autoRemediateBroker(body.diagnosticId, brokerRole(request), Boolean(body.confirmed), request));
  } catch (error) { return failure(error); }
}

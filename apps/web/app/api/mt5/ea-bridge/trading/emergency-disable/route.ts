import { failure, ok } from "../../../_lib/http";
import { eaBridgeRole, emergencyDisableEaTrading } from "../../_lib/store";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { confirmed?: boolean };
    return ok(emergencyDisableEaTrading(eaBridgeRole(request), Boolean(body.confirmed), request));
  } catch (error) { return failure(error); }
}

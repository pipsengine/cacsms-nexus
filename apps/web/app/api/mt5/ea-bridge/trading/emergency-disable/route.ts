import { failure, ok } from "../../../_lib/http";
import { withEaBridgeStore } from "../../_lib/handler";
import { eaBridgeRole, emergencyDisableEaTrading } from "../../_lib/store";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { confirmed?: boolean };
    return ok(await withEaBridgeStore(() =>
      emergencyDisableEaTrading(eaBridgeRole(request), Boolean(body.confirmed), request)
    ));
  } catch (error) {
    return failure(error);
  }
}

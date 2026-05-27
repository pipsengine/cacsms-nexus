import { failure, ok } from "../../../../_lib/http";
import { withEaBridgeStore } from "../../../_lib/handler";
import { eaBridgeRole, reissueEaPairingCredentials, testEaPairingCredentials } from "../../../_lib/store";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const body = (await request.json()) as { confirmed?: boolean };
    const id = (await context.params).id;
    return ok(await withEaBridgeStore(() => {
      const role = eaBridgeRole(request);
      const receipt = reissueEaPairingCredentials(id, role, Boolean(body.confirmed), request);
      const test = testEaPairingCredentials(
        receipt.eaInstanceId,
        receipt.ingestionToken,
        receipt.signingSecret,
        role,
        true,
        request
      );
      return { ...receipt, test };
    }));
  } catch (error) {
    return failure(error);
  }
}

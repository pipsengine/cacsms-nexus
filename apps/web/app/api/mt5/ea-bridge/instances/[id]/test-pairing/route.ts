import { failure, ok } from "../../../../_lib/http";
import { withEaBridgeStore } from "../../../_lib/handler";
import { eaBridgeRole, testEaPairingCredentials } from "../../../_lib/store";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const id = (await context.params).id;
    const body = (await request.json()) as {
      confirmed?: boolean;
      ingestionToken?: string;
      signingSecret?: string;
    };
    return ok(await withEaBridgeStore(() =>
      testEaPairingCredentials(
        id,
        body.ingestionToken ?? "",
        body.signingSecret ?? "",
        eaBridgeRole(request),
        Boolean(body.confirmed),
        request
      )
    ));
  } catch (error) {
    return failure(error);
  }
}

import { failure, ok } from "../../../_lib/http";
import { brokerRole, syncBrokerAccounts } from "../../_lib/store";

export async function POST(request: Request, context: { params: Promise<{ brokerId: string }> }) {
  try {
    const body = (await request.json()) as { confirmed?: boolean };
    return ok(syncBrokerAccounts((await context.params).brokerId, brokerRole(request), Boolean(body.confirmed), request));
  } catch (error) { return failure(error); }
}

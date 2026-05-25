import { failure, ok } from "../../_lib/http";
import { brokerRole, syncBrokerConnections } from "../_lib/store";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { confirmed?: boolean };
    return ok(syncBrokerConnections(brokerRole(request), Boolean(body.confirmed), request));
  } catch (error) { return failure(error); }
}

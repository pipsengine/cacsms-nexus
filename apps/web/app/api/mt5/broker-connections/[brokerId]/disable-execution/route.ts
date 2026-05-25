import { failure, ok } from "../../../_lib/http";
import { brokerRole, setBrokerExecution } from "../../_lib/store";

export async function POST(request: Request, context: { params: Promise<{ brokerId: string }> }) {
  try {
    const body = (await request.json()) as { confirmed?: boolean };
    return ok(setBrokerExecution((await context.params).brokerId, false, brokerRole(request), Boolean(body.confirmed), false, request));
  } catch (error) { return failure(error); }
}

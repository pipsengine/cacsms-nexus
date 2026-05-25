import { failure, ok } from "../../../_lib/http";
import { brokerRole, setBrokerExecution } from "../../_lib/store";

export async function POST(request: Request, context: { params: Promise<{ brokerId: string }> }) {
  try {
    const body = (await request.json()) as { confirmed?: boolean; riskApproved?: boolean };
    return ok(setBrokerExecution((await context.params).brokerId, true, brokerRole(request), Boolean(body.confirmed), Boolean(body.riskApproved), request));
  } catch (error) { return failure(error); }
}

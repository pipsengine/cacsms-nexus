import { ok } from "../../../_lib/http";
import { brokerIncidents } from "../../_lib/store";

export async function GET(_request: Request, context: { params: Promise<{ brokerId: string }> }) {
  return ok(brokerIncidents((await context.params).brokerId));
}

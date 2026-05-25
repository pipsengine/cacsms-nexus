import { ok } from "../../../_lib/http";
import { brokerAudits } from "../../_lib/store";

export async function GET(_request: Request, context: { params: Promise<{ brokerId: string }> }) {
  const id = (await context.params).brokerId;
  return ok(brokerAudits().filter((audit) => audit.entityId === id));
}

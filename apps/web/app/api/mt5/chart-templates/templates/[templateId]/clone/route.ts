import { failure, ok } from "../../../../_lib/http";
import { cloneTemplate, templateRole } from "../../../_lib/store";

export async function POST(request: Request, context: { params: Promise<{ templateId: string }> }) {
  try {
    const body = (await request.json()) as { confirmed?: boolean };
    return ok(cloneTemplate((await context.params).templateId, templateRole(request), Boolean(body.confirmed), request));
  } catch (error) { return failure(error); }
}

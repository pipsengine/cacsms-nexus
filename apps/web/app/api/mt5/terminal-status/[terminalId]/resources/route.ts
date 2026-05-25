import { failure, ok } from "../../../_lib/http";
import { terminalResources } from "../../_lib/store";

export async function GET(_: Request, context: { params: Promise<{ terminalId: string }> }) {
  try { return ok(terminalResources((await context.params).terminalId)); } catch (error) { return failure(error); }
}

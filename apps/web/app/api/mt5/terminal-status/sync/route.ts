import { failure, ok } from "../../_lib/http";
import { syncTerminalStatus, terminalStatusRole } from "../_lib/store";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { confirmed?: boolean };
    return ok(syncTerminalStatus(terminalStatusRole(request), Boolean(body.confirmed), request));
  } catch (error) { return failure(error); }
}

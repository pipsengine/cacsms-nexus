import { failure, ok } from "../_lib/http";
import { getRole, getTerminals, registerTerminal } from "../_lib/store";
import type { Terminal } from "@/modules/mt5-infrastructure-and-broker-connectivity/mt5-control-center/types/mt5-control-center.types";

export function GET() { return ok(getTerminals()); }

export async function POST(request: Request) {
  try {
    const body = await request.json() as Partial<Terminal> & { confirmed?: boolean };
    if (!body.confirmed) throw new Error("Confirmation is required for terminal registration.");
    return ok(registerTerminal(body, getRole(request), request), 201);
  } catch (error) { return failure(error); }
}

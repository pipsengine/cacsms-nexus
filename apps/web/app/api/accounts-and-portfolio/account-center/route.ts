import type { NextRequest } from "next/server";

import { failure, ok } from "../../mt5/_lib/http";
import {
  accountCenterRole,
  activateAccount,
  buildAccountCenterResponse,
  pinAccount,
  setAllocation
} from "./_lib/store";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const role = accountCenterRole(request);
    return ok(await buildAccountCenterResponse(role));
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { confirmed?: boolean; accountId?: string; allocationPercent?: number; pinned?: boolean; action?: string };
    const role = accountCenterRole(request);
    if (body.action === "pin" && body.accountId) {
      return ok(await pinAccount(body.accountId, Boolean(body.pinned), role, Boolean(body.confirmed), request));
    }
    if (body.action === "allocation" && body.accountId && body.allocationPercent != null) {
      return ok(await setAllocation(body.accountId, body.allocationPercent, role, Boolean(body.confirmed), request));
    }
    if (body.accountId) {
      return ok(await activateAccount(body.accountId, role, Boolean(body.confirmed), request));
    }
    throw new Error("Invalid account center action payload.");
  } catch (error) {
    return failure(error);
  }
}

import type { NextRequest } from "next/server";

import { failure, ok } from "../../../mt5/_lib/http";
import { createMt5EventStream } from "../../../mt5/_lib/realtime-stream";
import {
  accountCenterRole,
  accountCenterSummary,
  accountDetail,
  activateAccount,
  buildAccountCenterResponse,
  exportAccountCenter,
  pinAccount,
  setAllocation
} from "../_lib/store";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, context: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await context.params;
  const role = accountCenterRole(request);

  try {
    if (slug[0] === "events-stream") {
      return createMt5EventStream({
        request,
        eventName: "account-center-snapshot",
        snapshot: () => buildAccountCenterResponse(role)
      });
    }
    if (slug[0] === "summary") return ok(await accountCenterSummary(role));
    if (slug[0] === "accounts" && slug[1]) return ok(await accountDetail(slug[1], role));
    throw new Error("not found");
  } catch (error) {
    if (error instanceof Error && error.message === "not found") {
      return failure(new Error("Account center endpoint not found."));
    }
    return failure(error);
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await context.params;
  const role = accountCenterRole(request);
  const body = (await request.json()) as {
    confirmed?: boolean;
    reason?: string;
    pinned?: boolean;
    allocationPercent?: number;
  };

  try {
    if (slug[0] === "accounts" && slug[2] === "activate" && slug[1]) {
      return ok(await activateAccount(slug[1], role, Boolean(body.confirmed), request, body.reason));
    }
    if (slug[0] === "accounts" && slug[2] === "pin" && slug[1]) {
      return ok(await pinAccount(slug[1], Boolean(body.pinned), role, Boolean(body.confirmed), request));
    }
    if (slug[0] === "accounts" && slug[2] === "allocation" && slug[1] && body.allocationPercent != null) {
      return ok(await setAllocation(slug[1], body.allocationPercent, role, Boolean(body.confirmed), request));
    }
    if (slug[0] === "export") {
      const payload = (await request.json()) as { format?: "json" | "csv"; category?: string; search?: string };
      return ok(await exportAccountCenter(payload, role, request));
    }
    throw new Error("not found");
  } catch (error) {
    if (error instanceof Error && error.message === "not found") {
      return failure(new Error("Account center endpoint not found."));
    }
    return failure(error);
  }
}

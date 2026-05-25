import { NextResponse } from "next/server";

import type { ActionResponse, Role } from "@/modules/mt5-infrastructure-and-broker-connectivity/trade-synchronization/types/trade-synchronization.types";

const ALL_ROLES: Role[] = ["Super Admin", "Infrastructure Admin", "Trading Admin", "Risk Manager", "Analyst", "Viewer"];

export function getRequestRole(request: Request): Role {
  const raw = request.headers.get("x-nexus-role")?.trim();
  if (!raw) return "Viewer";
  return (ALL_ROLES as readonly string[]).includes(raw) ? (raw as Role) : "Viewer";
}

export function requireRole(request: Request, allowed: Role[], action: string, frozen: boolean) {
  const role = getRequestRole(request);
  if (allowed.includes(role)) return { role, response: null as NextResponse | null };
  const body: ActionResponse = {
    meta: { timestamp: new Date().toISOString(), frozen },
    ok: false,
    message: `${action} is not permitted for role: ${role}.`
  };
  return { role, response: NextResponse.json(body, { status: 403 }) };
}


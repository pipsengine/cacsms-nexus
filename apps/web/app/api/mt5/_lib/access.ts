import type { Mt5Role } from "@/modules/mt5-infrastructure-and-broker-connectivity/mt5-control-center/types/mt5-control-center.types";

const roles: Mt5Role[] = ["Super Admin", "Infrastructure Admin", "Trading Admin", "Risk Manager", "Analyst", "Read-Only Viewer"];

function normalizeRole(value: string | null | undefined): Mt5Role | null {
  const role = value === "Viewer" ? "Read-Only Viewer" : value as Mt5Role | null | undefined;
  return role && roles.includes(role) ? role : null;
}

export function resolveMt5Role(request?: Request): Mt5Role {
  const requestedRole = normalizeRole(request?.headers.get("x-mt5-role"));
  if (process.env.NODE_ENV !== "production" && requestedRole) return requestedRole;

  const localOperatorMode = process.env.NODE_ENV !== "production" && process.env.MT5_LOCAL_OPERATOR_MODE === "true";
  if (localOperatorMode) {
    return normalizeRole(process.env.MT5_LOCAL_OPERATOR_ROLE) ?? "Read-Only Viewer";
  }

  if (process.env.NODE_ENV !== "production") {
    return "Infrastructure Admin";
  }

  return "Read-Only Viewer";
}

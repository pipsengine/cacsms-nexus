import { mapAccountCenterToPortfolioDashboard } from "@/modules/accounts-and-portfolio/portfolio-dashboard/algorithms/portfolio-dashboard.algorithms";
import type { PortfolioDashboardResponse } from "@/modules/accounts-and-portfolio/portfolio-dashboard/types/portfolio-dashboard.types";
import type { Mt5Role } from "@/modules/mt5-infrastructure-and-broker-connectivity/mt5-control-center/types/mt5-control-center.types";
import { resolveMt5Role } from "../../../mt5/_lib/access";
import { accountCenterRole, buildAccountCenterResponse } from "../../account-center/_lib/store";

export function portfolioDashboardRole(request?: Request): Mt5Role {
  return resolveMt5Role(request);
}

export async function buildPortfolioDashboardResponse(
  role: Mt5Role = accountCenterRole(),
  highlightedAccountId: string | null = null
): Promise<PortfolioDashboardResponse> {
  const source = await buildAccountCenterResponse(role);
  const highlight =
    highlightedAccountId && source.accounts.some((account) => account.id === highlightedAccountId)
      ? highlightedAccountId
      : source.activeAccount?.id ?? null;
  return mapAccountCenterToPortfolioDashboard(source, highlight);
}

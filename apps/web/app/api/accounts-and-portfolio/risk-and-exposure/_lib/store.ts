import { mapToRiskAndExposureResponse } from "@/modules/accounts-and-portfolio/risk-and-exposure/algorithms/risk-and-exposure.algorithms";
import type { RiskAndExposureResponse } from "@/modules/accounts-and-portfolio/risk-and-exposure/types/risk-and-exposure.types";
import type { Mt5Role } from "@/modules/mt5-infrastructure-and-broker-connectivity/mt5-control-center/types/mt5-control-center.types";
import { resolveMt5Role } from "../../../mt5/_lib/access";
import { accountCenterRole, buildAccountCenterResponse } from "../../account-center/_lib/store";

export function riskAndExposureRole(request?: Request): Mt5Role {
  return resolveMt5Role(request);
}

async function loadAccountSyncData() {
  const { accounts, exposure } = await import("../../../mt5/account-sync/_lib/store");
  return { synced: accounts(), exposures: exposure() };
}

export async function buildRiskAndExposureResponse(
  role: Mt5Role = accountCenterRole(),
  highlightedAccountId: string | null = null
): Promise<RiskAndExposureResponse> {
  const [source, syncData] = await Promise.all([buildAccountCenterResponse(role), loadAccountSyncData()]);
  const highlight =
    highlightedAccountId && source.accounts.some((account) => account.id === highlightedAccountId)
      ? highlightedAccountId
      : source.activeAccount?.id ?? null;

  return mapToRiskAndExposureResponse({
    source,
    synced: syncData.synced,
    exposures: syncData.exposures,
    highlightedAccountId: highlight
  });
}

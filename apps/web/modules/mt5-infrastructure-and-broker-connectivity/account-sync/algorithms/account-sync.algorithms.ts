import type { AccountExposure, AccountReconciliation, AccountScore, ExposureSummary, SyncedAccount } from "../types/account-sync.types";

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));
function rating(score: number): AccountScore["rating"] {
  if (score >= 90) return "Excellent";
  if (score >= 75) return "Healthy";
  if (score >= 60) return "Degraded";
  if (score >= 40) return "High Risk";
  return "Critical";
}

export function classifyReconciliation(input: Omit<AccountReconciliation, "reconciliationStatus" | "requiredAction">) {
  const monetaryDifference = Math.max(Math.abs(input.balanceDifference), Math.abs(input.equityDifference), Math.abs(input.marginDifference), Math.abs(input.profitLossDifference));
  const countDifference = Math.max(Math.abs(input.positionCountDifference), Math.abs(input.pendingOrderCountDifference));
  if (!Number.isFinite(monetaryDifference)) return { status: "Failed" as const, action: "Retry snapshot ingestion and preserve trading block." };
  if (monetaryDifference === 0 && countDifference === 0) return { status: "Matched" as const, action: "No action required." };
  if (monetaryDifference <= 25 && countDifference === 0) return { status: "Minor Difference" as const, action: "Monitor until the next sync cycle." };
  if (monetaryDifference > 250 || countDifference > 0) return { status: "Material Difference" as const, action: "Reconcile immediately and suspend execution if unresolved." };
  return { status: "Requires Review" as const, action: "Risk Manager review required." };
}

export function validateTradingReadiness(account: SyncedAccount) {
  const failed = [
    !account.tradingAllowed && "Account trading disabled",
    !account.expertTradingAllowed && "Expert trading disabled",
    !account.symbolPermissionsValid && "Symbol permissions invalid",
    !account.minimumLotCompatible && "Lot compatibility invalid",
    account.freeMargin <= 0 && "Insufficient margin",
    account.riskEngineStatus !== "Healthy" && "Risk engine unavailable",
    !account.eaBridgeLinked && "EA bridge not linked"
  ].filter(Boolean) as string[];
  return { executionReady: failed.length === 0, failures: failed };
}

export function detectSyncDelay(account: SyncedAccount, configuredIntervalSeconds = 60) {
  const stale = account.syncDelaySeconds > configuredIntervalSeconds;
  const unsafe = stale && (account.dataMismatchCount > 0 || account.openPositionsCount > 0 || account.pendingOrdersCount > 0);
  return { delayed: stale, unsafe, ageSeconds: account.syncDelaySeconds };
}

export function calculateExposureRisk(account: SyncedAccount, exposures: AccountExposure[]): ExposureSummary {
  const relevant = exposures.filter((exposure) => exposure.accountId === account.id);
  const totalExposure = relevant.reduce((sum, exposure) => sum + Math.abs(exposure.notionalExposure), 0);
  const longExposure = relevant.reduce((sum, exposure) => sum + exposure.longVolume * exposure.notionalExposure, 0);
  const shortExposure = relevant.reduce((sum, exposure) => sum + exposure.shortVolume * exposure.notionalExposure, 0);
  const marginUtilization = account.equity ? Math.round(account.margin / account.equity * 100) : 100;
  const floatingDrawdown = account.balance ? Math.round(Math.max(0, -account.floatingProfitLoss) / account.balance * 100) : 100;
  const largest = relevant.reduce((highest, exposure) => Math.max(highest, Math.abs(exposure.notionalExposure)), 0);
  const concentrationRisk = totalExposure ? Math.round(largest / totalExposure * 100) : 0;
  const grouped = relevant.reduce<Record<string, number>>((groups, exposure) => ({ ...groups, [exposure.correlationGroup]: (groups[exposure.correlationGroup] ?? 0) + Math.abs(exposure.notionalExposure) }), {});
  const correlatedExposureWarning = Object.values(grouped).some((amount) => totalExposure > 0 && amount / totalExposure > 0.65);
  const riskScore = clamp(Math.round(marginUtilization * 0.35 + floatingDrawdown * 2 + concentrationRisk * 0.3 + (correlatedExposureWarning ? 18 : 0) + (account.riskLevel === "Critical" ? 20 : 0)));
  const riskLevel: ExposureSummary["riskLevel"] = riskScore >= 80 ? "Critical" : riskScore >= 65 ? "High" : riskScore >= 45 ? "Elevated" : riskScore >= 25 ? "Moderate" : "Low";
  return { accountId: account.id, totalExposure, marginUtilization, floatingDrawdown, concentrationRisk, correlatedExposureWarning, longExposure, shortExposure, riskScore, riskLevel, emergencyRiskFlag: riskLevel === "Critical" };
}

export function calculateAccountSyncHealth(account: SyncedAccount, reconciliation: AccountReconciliation): AccountScore {
  const readiness = validateTradingReadiness(account);
  const delay = detectSyncDelay(account);
  const factors = {
    loginScore: account.accountStatus !== "Critical" ? 14 : 0,
    snapshotScore: account.syncStatus === "Healthy" ? 14 : account.syncStatus === "Degraded" ? 8 : 0,
    balanceSyncScore: reconciliation.reconciliationStatus === "Matched" ? 14 : reconciliation.reconciliationStatus === "Minor Difference" ? 9 : 0,
    positionSyncScore: account.dataMismatchCount === 0 ? 13 : 5,
    orderSyncScore: account.dataMismatchCount === 0 ? 12 : 4,
    permissionSyncScore: readiness.executionReady ? 13 : 4,
    reconciliationScore: reconciliation.reconciliationStatus === "Matched" ? 20 : reconciliation.reconciliationStatus === "Minor Difference" ? 10 : 0,
    mismatchPenalty: -Math.min(24, account.dataMismatchCount * 8),
    delayPenalty: delay.delayed ? -Math.min(18, Math.round(account.syncDelaySeconds / 30)) : 0
  };
  const score = clamp(Object.values(factors).reduce((sum, value) => sum + value, 0));
  return { score, rating: rating(score), factors };
}

export function recoveryWorkflow(account: SyncedAccount) {
  const steps = ["Detect account issue", "Validate broker connection", "Validate terminal heartbeat", "Re-authenticate account session", "Retry account snapshot sync", "Retry position sync", "Retry pending order sync", "Run reconciliation"];
  if (account.riskLevel === "Critical" || account.dataMismatchCount > 0) steps.push("Disable trading if data remains unsafe");
  steps.push("Log incident and notify administrator");
  return steps;
}

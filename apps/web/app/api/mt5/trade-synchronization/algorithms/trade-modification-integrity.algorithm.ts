import type { TradeModification } from "@/modules/mt5-infrastructure-and-broker-connectivity/trade-synchronization/types/trade-synchronization.types";

export type ModificationIntegrityIssue = {
  modificationId: string;
  tradeId: string;
  severity: "Info" | "Warning" | "Critical";
  reason: string;
};

function byTime(a: TradeModification, b: TradeModification) {
  return new Date(a.appliedAt).getTime() - new Date(b.appliedAt).getTime();
}

export function validateModificationIntegrity(modifications: TradeModification[]) {
  const issues: ModificationIntegrityIssue[] = [];
  const sorted = [...modifications].sort(byTime);

  for (let i = 1; i < sorted.length; i += 1) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    const prevTime = new Date(prev.appliedAt).getTime();
    const currTime = new Date(curr.appliedAt).getTime();

    if (currTime < prevTime) {
      issues.push({
        modificationId: curr.modificationId,
        tradeId: curr.tradeId,
        severity: "Critical",
        reason: "Modification timestamps are out of order (integrity violation)."
      });
    }
  }

  for (const mod of sorted) {
    if (mod.source === "Broker" || mod.source === "Operator") {
      issues.push({
        modificationId: mod.modificationId,
        tradeId: mod.tradeId,
        severity: "Warning",
        reason: "Manual or broker-side modification detected; requires review and audit validation."
      });
    }
    if (mod.status === "Failed") {
      issues.push({
        modificationId: mod.modificationId,
        tradeId: mod.tradeId,
        severity: "Critical",
        reason: "Modification failed to apply or sync; state drift risk."
      });
    }
  }

  return issues;
}


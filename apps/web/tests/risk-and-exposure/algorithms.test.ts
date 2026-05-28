import { describe, expect, it } from "vitest";
import {
  buildRiskAccountSnapshots,
  buildRiskKpis,
  buildRiskWarnings,
  buildRiskWorkflow,
  buildSymbolExposureRows,
  mapToRiskAndExposureResponse,
  parseLeverageRatio
} from "@/modules/accounts-and-portfolio/risk-and-exposure/algorithms/risk-and-exposure.algorithms";
import { mapSyncedAccountToPortfolio } from "@/modules/accounts-and-portfolio/account-center/algorithms/account-center.algorithms";
import type { AccountCenterResponse } from "@/modules/accounts-and-portfolio/account-center/types/account-center.types";
import { createAccountSyncSeed } from "@/tests/fixtures/account-sync.fixture";

function buildAccountCenterFixture(): AccountCenterResponse {
  const seed = createAccountSyncSeed();
  const timestamp = new Date().toISOString();
  const mapped = seed.accounts.map((account) =>
    mapSyncedAccountToPortfolio(account, {
      activeAccountId: seed.accounts[0]!.id,
      pinnedAccountIds: [],
      allocationOverrides: {},
      defaultAllocation: 33.3
    })
  );

  return {
    meta: {
      timestamp,
      currentRole: "Infrastructure Admin",
      streamEndpoint: "/api/accounts-and-portfolio/account-center/events-stream",
      monitoringMode: "Autonomous Portfolio Workspace",
      activeAccountId: mapped[0]!.id
    },
    kpis: [],
    workflow: [],
    accounts: mapped,
    groups: [],
    activeAccount: mapped[0]!,
    switchHistory: [],
    quickLinks: [],
    permissions: {
      role: "Infrastructure Admin",
      canSwitch: true,
      canPin: true,
      canExport: true,
      canManageAllocation: true
    },
    audits: []
  };
}

describe("Risk and Exposure algorithms", () => {
  it("parses leverage ratios from broker labels", () => {
    expect(parseLeverageRatio("1:100")).toBe(100);
    expect(parseLeverageRatio("1:200")).toBe(200);
    expect(parseLeverageRatio("invalid")).toBe(0);
  });

  it("builds account snapshots with sync exposure data", () => {
    const seed = createAccountSyncSeed();
    const source = buildAccountCenterFixture();
    const snapshots = buildRiskAccountSnapshots(source, seed.accounts, seed.exposures);
    expect(snapshots).toHaveLength(3);
    expect(snapshots[0]?.exposure.totalExposure).toBeGreaterThan(0);
    expect(snapshots[2]?.exposure.emergencyRiskFlag).toBe(true);
  });

  it("sorts symbol exposure rows by notional size", () => {
    const rows = buildSymbolExposureRows(createAccountSyncSeed().exposures);
    expect(rows[0]?.notionalExposure).toBeGreaterThanOrEqual(rows[1]?.notionalExposure ?? 0);
    expect(rows).toHaveLength(4);
  });

  it("surfaces margin, leverage, and emergency warnings", () => {
    const seed = createAccountSyncSeed();
    const source = buildAccountCenterFixture();
    const snapshots = buildRiskAccountSnapshots(source, seed.accounts, seed.exposures);
    const warnings = buildRiskWarnings(snapshots);
    expect(warnings.some((warning) => warning.title === "Emergency risk flag")).toBe(true);
    expect(warnings.some((warning) => warning.title === "High leverage profile")).toBe(true);
  });

  it("maps a full risk and exposure response", () => {
    const seed = createAccountSyncSeed();
    const source = buildAccountCenterFixture();
    const response = mapToRiskAndExposureResponse({
      source,
      synced: seed.accounts,
      exposures: seed.exposures,
      highlightedAccountId: seed.accounts[0]!.id
    });

    expect(response.meta.monitoringMode).toMatch(/Risk & Exposure/i);
    expect(response.kpis.length).toBeGreaterThan(5);
    expect(response.workflow).toHaveLength(6);
    expect(response.accounts).toHaveLength(3);
    expect(response.permissions.canManageRisk).toBe(true);
    expect(buildRiskKpis(response.accounts, source.meta.timestamp).length).toBe(7);
    expect(buildRiskWorkflow(response.accounts).length).toBe(6);
  });
});

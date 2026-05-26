import { describe, expect, it, beforeEach } from "vitest";
import { seedAccountSyncStore } from "@/tests/helpers/seed-api-stores";
import { accountRole, audits, buildAccountSyncResponse, reconcileAccount, setAccountTrading, syncAllAccounts, syncSelectedAccounts, syncTradingState } from "@/app/api/mt5/account-sync/_lib/store";

describe("Account Sync operational controls", () => {
  beforeEach(() => seedAccountSyncStore());
  it("returns synchronized operational sections", () => {
    const response = buildAccountSyncResponse("Infrastructure Admin");
    expect(response.kpis).toHaveLength(12);
    expect(response.workflow).toHaveLength(10);
    expect(response.positions.length).toBeGreaterThan(0);
    expect(response.reconciliations.length).toBeGreaterThan(0);
    expect(response.diagnostics.length).toBeGreaterThan(0);
  });
  it("enforces role and confirmation restrictions", () => {
    expect(accountRole(new Request("http://localhost/api/mt5/account-sync"))).toBe("Read-Only Viewer");
    expect(() => syncAllAccounts("Read-Only Viewer", true)).toThrow(/not authorized/);
    expect(() => syncSelectedAccounts(["acct-1"], "Infrastructure Admin", false)).toThrow(/Confirmation/);
    expect(() => setAccountTrading("acct-1", false, "Read-Only Viewer", true)).toThrow(/not authorized/);
  });
  it("synchronizes selected trading state and audits reconciliation", () => {
    const before = audits().length;
    expect(syncSelectedAccounts(["acct-1"], "Infrastructure Admin", true)).toHaveLength(1);
    expect(syncTradingState("acct-1", "positions", "Infrastructure Admin", true).every((position) => position.syncStatus === "Healthy")).toBe(true);
    expect(reconcileAccount("acct-2", "Risk Manager", true).reconciliationStatus).toBe("Material Difference");
    expect(audits().length).toBeGreaterThan(before);
  });
  it("does not enable an execution-unsafe account", () => {
    expect(() => setAccountTrading("acct-3", true, "Trading Admin", true)).toThrow(/Trading enable blocked/);
  });
});

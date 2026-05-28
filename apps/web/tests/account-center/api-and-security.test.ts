import { beforeEach, describe, expect, it } from "vitest";
import { seedAccountSyncStore } from "@/tests/helpers/seed-api-stores";
import {
  accountCenterRole,
  activateAccount,
  buildAccountCenterResponse,
  exportAccountCenter,
  pinAccount,
  resetAccountCenterState
} from "@/app/api/accounts-and-portfolio/account-center/_lib/store";

describe("Account Center API domain and security", () => {
  beforeEach(() => {
    resetAccountCenterState();
    seedAccountSyncStore();
  });

  it("defaults to infrastructure admin in local dev when no header provided", () => {
    expect(accountCenterRole(new Request("http://localhost/api/accounts-and-portfolio/account-center"))).toBe("Infrastructure Admin");
  });

  it("aggregates synced accounts into an inventory response", async () => {
    const response = await buildAccountCenterResponse("Infrastructure Admin");
    expect(response.accounts.length).toBeGreaterThan(0);
    expect(response.activeAccount).toBeTruthy();
    expect(response.kpis.length).toBeGreaterThan(6);
  });

  it("activates a switchable workspace account with audit history", async () => {
    const before = await buildAccountCenterResponse("Infrastructure Admin");
    const target = before.accounts.find((account) => account.switchable)!;
    await activateAccount(target.id, "Super Admin", true);
    const after = await buildAccountCenterResponse("Infrastructure Admin");
    expect(after.activeAccount?.id).toBe(target.id);
    expect(after.switchHistory[0]?.accountId).toBe(target.id);
  });

  it("restricts pinning to authorized roles", async () => {
    const response = await buildAccountCenterResponse("Infrastructure Admin");
    const target = response.accounts[0]!;
    await expect(pinAccount(target.id, true, "Read-Only Viewer", true)).rejects.toThrow(/not authorized/i);
    await expect(pinAccount(target.id, true, "Super Admin", true)).resolves.toMatchObject({ ok: true });
  });

  it("exports inventory for authorized roles", async () => {
    const result = await exportAccountCenter({ format: "json" }, "Infrastructure Admin");
    expect(result.ok).toBe(true);
    expect(result.total).toBeGreaterThan(0);
  });
});

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildAccountSyncResponse } from "@/app/api/mt5/account-sync/_lib/store";
import { AccountSyncDashboard } from "@/modules/mt5-infrastructure-and-broker-connectivity/account-sync/components/account-sync-dashboard";

vi.mock("@/modules/mt5-infrastructure-and-broker-connectivity/account-sync/hooks/use-account-sync", () => ({
  useAccountSync: () => ({ data: buildAccountSyncResponse("Read-Only Viewer"), isLoading: false, isError: false, streamConnected: true, refetch: vi.fn(), action: { mutateAsync: vi.fn(), isPending: false } })
}));
afterEach(cleanup);

describe("Account Sync dashboard", () => {
  it("renders account reconciliation operations and protects viewer actions", () => {
    render(<AccountSyncDashboard />);
    expect(screen.getByRole("heading", { name: "Account Sync" })).toBeInTheDocument();
    expect(screen.getByText("Balance Reconciliation")).toBeInTheDocument();
    expect(screen.getByText("AI Account Sync Diagnostics")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Sync All Accounts/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Disable Account Trading/i })).toBeDisabled();
  });
  it("filters the responsive account registry", () => {
    render(<AccountSyncDashboard />);
    fireEvent.change(screen.getByLabelText("Search synchronized accounts"), { target: { value: "IC Markets" } });
    const registry = within(screen.getByRole("table", { name: "Account synchronization registry" }));
    expect(registry.getByText("IC Markets")).toBeInTheDocument();
    expect(registry.queryByText("FTMO")).not.toBeInTheDocument();
  });
});

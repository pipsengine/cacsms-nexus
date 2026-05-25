import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildOrderRouterResponse } from "@/app/api/mt5/order-router/_lib/store";
import { OrderRouterDashboard } from "@/modules/mt5-infrastructure-and-broker-connectivity/order-router/components/order-router-dashboard";

vi.mock("@/modules/mt5-infrastructure-and-broker-connectivity/order-router/hooks/use-order-router", () => ({
  useOrderRouter: () => ({ data: buildOrderRouterResponse("Read-Only Viewer"), isLoading: false, isError: false, streamConnected: true, refetch: vi.fn(), action: { mutateAsync: vi.fn(), isPending: false } })
}));
afterEach(cleanup);

describe("Order Router dashboard", () => {
  it("renders command-center sections and protects viewer routing actions", () => {
    render(<OrderRouterDashboard />);
    expect(screen.getByRole("heading", { name: "Order Router" })).toBeInTheDocument();
    expect(screen.getByText("Order Routing Workflow")).toBeInTheDocument();
    expect(screen.getByText("Risk Gate & Blocking Panel")).toBeInTheDocument();
    expect(screen.getByText("Execution Feedback Monitor")).toBeInTheDocument();
    expect(screen.getByText("AI Order Router Diagnostics")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Pause Order Routing/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Emergency Stop Routing/i })).toBeDisabled();
  });

  it("searches and filters the routing queue", () => {
    render(<OrderRouterDashboard />);
    fireEvent.change(screen.getByLabelText("Search routing queue"), { target: { value: "FTMO" } });
    const table = within(screen.getByRole("table", { name: "Order routing queue" }));
    expect(table.getByText("FTMO")).toBeInTheDocument();
    expect(table.queryByText("IC Markets")).not.toBeInTheDocument();
  });
});

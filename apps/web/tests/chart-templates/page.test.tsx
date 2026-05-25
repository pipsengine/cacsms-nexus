import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildChartTemplatesResponse } from "@/app/api/mt5/chart-templates/_lib/store";
import { ChartTemplatesDashboard } from "@/modules/mt5-infrastructure-and-broker-connectivity/chart-templates/components/chart-templates-dashboard";

vi.mock("@/modules/mt5-infrastructure-and-broker-connectivity/chart-templates/hooks/use-chart-templates", () => ({
  useChartTemplates: () => ({ data: buildChartTemplatesResponse("Read-Only Viewer"), isLoading: false, isError: false, streamConnected: true, refetch: vi.fn(), action: { mutateAsync: vi.fn(), isPending: false } })
}));
afterEach(cleanup);

describe("Chart Templates dashboard", () => {
  it("renders registry governance and protects viewer lifecycle actions", () => {
    render(<ChartTemplatesDashboard />);
    expect(screen.getByRole("heading", { name: "Chart Templates" })).toBeInTheDocument();
    expect(screen.getByText("Template Registry")).toBeInTheDocument();
    expect(screen.getByText("Selected Template Definition")).toBeInTheDocument();
    expect(screen.getByText("Validation & Governance Queue")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Validate Selected" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Clone Template" })).toBeDisabled();
  });

  it("selects and searches templates in the registry", () => {
    render(<ChartTemplatesDashboard />);
    fireEvent.change(screen.getByLabelText("Search chart templates"), { target: { value: "Liquidity" } });
    const table = within(screen.getByRole("table", { name: "Chart template registry" }));
    expect(table.getByText("Intraday Liquidity Scan")).toBeInTheDocument();
    expect(table.queryByText("Macro Swing Structure")).not.toBeInTheDocument();
  });
});

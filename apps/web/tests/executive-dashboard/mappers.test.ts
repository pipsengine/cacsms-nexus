import { describe, expect, it } from "vitest";

import { getExecutiveDashboardMock } from "@/modules/executive-overview/executive-dashboard/data/executive-dashboard.mock";
import { mapExecutiveDashboardCharts } from "@/modules/executive-overview/executive-dashboard/utils/executive-dashboard-mappers";

describe("executive dashboard mappers", () => {
  it("builds chart series without throwing", () => {
    const mock = getExecutiveDashboardMock();
    const charts = mapExecutiveDashboardCharts(mock);

    expect(Array.isArray(charts.aiConfidenceTrend)).toBe(true);
    expect(Array.isArray(charts.riskPressureBreakdown)).toBe(true);
    expect(charts.aiConfidenceTrend.length).toBeGreaterThan(0);
    expect(charts.aiConfidenceTrend[0]).toHaveProperty("confidence");
  });
});


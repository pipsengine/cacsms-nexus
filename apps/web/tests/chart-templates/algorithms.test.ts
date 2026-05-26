import { describe, expect, it } from "vitest";
import { calculateTemplateHealth, detectTemplateIssues, nextVersion, templateCompleteness } from "@/modules/mt5-infrastructure-and-broker-connectivity/chart-templates/algorithms/chart-templates.algorithms";
import { createChartTemplatesSeed } from "@/tests/fixtures/chart-templates.fixture";

describe("chart-template algorithms", () => {
  it("identifies stale, incomplete, and affected preset definitions", () => {
    const templates = createChartTemplatesSeed().templates;
    const issues = detectTemplateIssues(templates);
    expect(issues.some((issue) => issue.templateId === "template-risk" && issue.issueType === "Offline Instrument")).toBe(true);
    expect(issues.some((issue) => issue.templateId === "template-swing" && issue.issueType === "Stale Validation")).toBe(true);
    expect(templateCompleteness(templates.find((template) => template.id === "template-swing")!)).toBeLessThan(100);
  });

  it("scores registry posture below perfect when validation issues are present", () => {
    const health = calculateTemplateHealth(createChartTemplatesSeed().templates);
    expect(health.score).toBeLessThan(100);
    expect(health.rating).not.toBe("Excellent");
  });

  it("increments minor versions when templates are cloned", () => {
    expect(nextVersion("v3.2")).toBe("v3.3");
    expect(nextVersion("not-versioned")).toBe("v1.0");
  });
});

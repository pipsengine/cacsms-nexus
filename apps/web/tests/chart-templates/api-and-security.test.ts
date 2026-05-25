import { describe, expect, it } from "vitest";
import { archiveTemplate, audits, buildChartTemplatesResponse, cloneTemplate, publishTemplate, templateRole, validateTemplate } from "@/app/api/mt5/chart-templates/_lib/store";

describe("Chart Templates operational controls", () => {
  it("returns catalog, deployment, health, and governance sections", () => {
    const response = buildChartTemplatesResponse("Infrastructure Admin");
    expect(response.kpis).toHaveLength(8);
    expect(response.templates.length).toBeGreaterThanOrEqual(5);
    expect(response.deployments.length).toBeGreaterThan(0);
    expect(response.issues.some((issue) => issue.issueType === "Offline Instrument")).toBe(true);
  });

  it("requires authorization and confirmation for lifecycle actions", () => {
    expect(templateRole(new Request("http://localhost/api/mt5/chart-templates"))).toBe("Read-Only Viewer");
    expect(() => validateTemplate("template-risk", "Read-Only Viewer", true)).toThrow(/not authorized/);
    expect(() => cloneTemplate("template-execution", "Analyst", false)).toThrow(/Confirmation/);
    expect(() => publishTemplate("template-swing", "Risk Manager", true)).toThrow(/pass validation/);
  });

  it("validates, clones, publishes, archives, and audits controlled changes", () => {
    const before = audits().length;
    expect(validateTemplate("template-risk", "Risk Manager", true).validationStatus).toBe("Healthy");
    expect(publishTemplate("template-risk", "Risk Manager", true).status).toBe("Published");
    expect(cloneTemplate("template-execution", "Analyst", true).status).toBe("Draft");
    expect(archiveTemplate("template-swing", "Infrastructure Admin", true).status).toBe("Archived");
    expect(audits().length).toBeGreaterThan(before);
  });
});

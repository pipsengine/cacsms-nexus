import type { ChartTemplate, TemplateHealth, TemplateIssue } from "../types/chart-templates.types";

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));
const rating = (score: number): TemplateHealth["rating"] => score >= 90 ? "Excellent" : score >= 75 ? "Healthy" : score >= 60 ? "Degraded" : score >= 40 ? "High Risk" : "Critical";

export function detectTemplateIssues(templates: ChartTemplate[], now = Date.now()) {
  const issues: TemplateIssue[] = [];
  const add = (template: ChartTemplate, issueType: TemplateIssue["issueType"], severity: TemplateIssue["severity"], detail: string, recommendation: string) =>
    issues.push({ id: `${template.id}-${issueType.toLowerCase().replace(/\s+/g, "-")}`, templateId: template.id, templateName: template.name, issueType, severity, detail, recommendation, detectedAt: new Date(now).toISOString() });
  templates.filter((template) => template.status !== "Archived").forEach((template) => {
    const ageHours = (now - new Date(template.lastValidatedAt).getTime()) / 3_600_000;
    if (ageHours > 24) add(template, "Stale Validation", template.status === "Published" ? "Critical" : "Warning", `Validation is ${Math.round(ageHours)} hours old.`, "Run validation before publishing or deploying this preset.");
    if (!template.indicators.some((indicator) => indicator.name === "RSI" || indicator.name === "ATR") && template.category === "Risk") add(template, "Missing Indicator", "Critical", "Risk preset does not include a volatility or momentum monitor.", "Require ATR or RSI before approval.");
    if (!template.alertRules.length && template.status !== "Draft") add(template, "Unsafe Alert Rule", "Warning", "Template has no monitoring alert rules configured.", "Configure data and risk triggers before use.");
    if (template.symbols.includes("NAS100") && template.activeDeployments > 0 && template.category === "Risk") add(template, "Offline Instrument", "Critical", "A deployment references NAS100 while its chart feed is under incident review.", "Keep deployment in review until quote delivery recovers.");
  });
  const publishedNames = new Map<string, ChartTemplate[]>();
  templates.filter((template) => template.status === "Published").forEach((template) => publishedNames.set(template.name, [...(publishedNames.get(template.name) ?? []), template]));
  publishedNames.forEach((entries) => {
    if (entries.length > 1) entries.forEach((template) => add(template, "Version Conflict", "Critical", "Multiple versions are marked published.", "Archive the superseded published version."));
  });
  return issues;
}

export function calculateTemplateHealth(templates: ChartTemplate[], now = Date.now()) {
  const active = templates.filter((template) => template.status !== "Archived");
  const total = active.length || 1;
  const issues = detectTemplateIssues(active, now);
  const factors = {
    validation: active.filter((template) => template.validationStatus === "Healthy").length / total * 35,
    governance: active.filter((template) => template.status === "Published" || template.status === "In Review").length / total * 20,
    alertCoverage: active.filter((template) => template.alertRules.length > 0).length / total * 20,
    deploymentReadiness: active.filter((template) => template.validationStatus !== "Critical").length / total * 25,
    criticalPenalty: -issues.filter((issue) => issue.severity === "Critical").length * 8
  };
  const score = clamp(Object.values(factors).reduce((sum, value) => sum + value, 0));
  return { score, rating: rating(score), factors };
}

export function templateCompleteness(template: ChartTemplate) {
  const checks = [template.symbols.length > 0, template.timeframes.length === template.symbols.length, template.indicators.length > 0, template.drawingTools.length > 0, template.riskOverlays.length > 0, template.alertRules.length > 0];
  return Math.round(checks.filter(Boolean).length / checks.length * 100);
}

export function nextVersion(version: string) {
  const match = version.match(/^v(\d+)\.(\d+)/);
  if (!match) return "v1.0";
  return `v${match[1]}.${Number(match[2]) + 1}`;
}

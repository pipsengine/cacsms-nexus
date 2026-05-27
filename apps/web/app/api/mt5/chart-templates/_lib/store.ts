import type { AuditRecord, Mt5Role } from "@/modules/mt5-infrastructure-and-broker-connectivity/mt5-control-center/types/mt5-control-center.types";
import { calculateTemplateHealth, detectTemplateIssues, nextVersion, templateCompleteness } from "@/modules/mt5-infrastructure-and-broker-connectivity/chart-templates/algorithms/chart-templates.algorithms";
import type { ChartTemplate, TemplateResponse } from "@/modules/mt5-infrastructure-and-broker-connectivity/chart-templates/types/chart-templates.types";
import { resolveMt5Role } from "../../_lib/access";
import { bindPersistedMt5State, ensureMt5ModuleHydrated } from "../../_lib/persistence";

const state = bindPersistedMt5State("chart-templates", () => ({
  templates: [] as ChartTemplate[],
  deployments: [] as any[],
  audits: [] as AuditRecord[]
}));

await ensureMt5ModuleHydrated("chart-templates");

export function resetChartTemplatesState(override?: Partial<typeof state>) {
  state.templates = override?.templates ?? [];
  state.deployments = (override as any)?.deployments ?? [];
  state.audits = [];
}

const permissions: Record<string, Mt5Role[]> = {
  create: ["Super Admin", "Infrastructure Admin", "Trading Admin", "Risk Manager", "Analyst"],
  clone: ["Super Admin", "Infrastructure Admin", "Trading Admin", "Risk Manager", "Analyst"],
  validate: ["Super Admin", "Infrastructure Admin", "Trading Admin", "Risk Manager"],
  publish: ["Super Admin", "Trading Admin", "Risk Manager"],
  archive: ["Super Admin", "Infrastructure Admin"]
};

export function templateRole(request?: Request): Mt5Role {
  return resolveMt5Role(request);
}
function authorize(role: Mt5Role, action: keyof typeof permissions) {
  if (!permissions[action].includes(role)) throw new Error(`Role "${role}" is not authorized to perform chart template ${action}.`);
}
function confirm(confirmed?: boolean) {
  if (!confirmed) throw new Error("Confirmation is required for this chart-template action.");
}
function audit(role: Mt5Role, action: string, entityId: string, oldValue: unknown, newValue: unknown, request?: Request) {
  state.audits.unshift({ id: `template-audit-${Date.now()}-${state.audits.length}`, userId: request?.headers.get("x-user-id") ?? role.toLowerCase().replace(/\s+/g, "-"), action, module: "Chart Templates", entityId, oldValue, newValue, ipAddress: request?.headers.get("x-forwarded-for") ?? "system", userAgent: request?.headers.get("user-agent") ?? "template-registry", timestamp: new Date().toISOString() });
}
function template(id: string) {
  const found = state.templates.find((entry) => entry.id === id);
  if (!found) throw new Error("Chart template not found.");
  return found;
}

export function audits() { return state.audits; }

export function validateTemplate(id: string, role: Mt5Role, confirmed: boolean, request?: Request) {
  authorize(role, "validate"); confirm(confirmed);
  const item = template(id);
  const previous = { status: item.validationStatus, validatedAt: item.lastValidatedAt };
  const incomplete = templateCompleteness(item) < 70;
  item.lastValidatedAt = new Date().toISOString();
  item.validationStatus = incomplete ? "Degraded" : "Healthy";
  audit(role, "Template validated", id, previous, { validationStatus: item.validationStatus, completeness: templateCompleteness(item) }, request);
  return item;
}

export function cloneTemplate(id: string, role: Mt5Role, confirmed: boolean, request?: Request) {
  authorize(role, "clone"); confirm(confirmed);
  const source = template(id);
  const cloned: ChartTemplate = { ...source, id: `template-${Date.now()}`, name: `${source.name} Copy`, version: nextVersion(source.version), status: "Draft", visibility: "Private", owner: role, usageCount: 0, activeDeployments: 0, updatedAt: new Date().toISOString(), lastValidatedAt: new Date(0).toISOString(), validationStatus: "Watch", indicators: source.indicators.map((indicator) => ({ ...indicator })), symbols: [...source.symbols], timeframes: [...source.timeframes], drawingTools: [...source.drawingTools], riskOverlays: [...source.riskOverlays], alertRules: [...source.alertRules] };
  state.templates.unshift(cloned);
  audit(role, "Template cloned", cloned.id, source.id, { name: cloned.name, version: cloned.version }, request);
  return cloned;
}

export function publishTemplate(id: string, role: Mt5Role, confirmed: boolean, request?: Request) {
  authorize(role, "publish"); confirm(confirmed);
  const item = template(id);
  if (item.validationStatus !== "Healthy") throw new Error("Template must pass validation before publishing.");
  const old = item.status;
  item.status = "Published";
  item.visibility = "Institution";
  item.updatedAt = new Date().toISOString();
  audit(role, "Template published", id, old, item.status, request);
  return item;
}

export function archiveTemplate(id: string, role: Mt5Role, confirmed: boolean, request?: Request) {
  authorize(role, "archive"); confirm(confirmed);
  const item = template(id);
  if (item.activeDeployments > 0) throw new Error("Active template deployments must be removed before archiving.");
  const old = item.status;
  item.status = "Archived";
  item.validationStatus = "Inactive";
  item.updatedAt = new Date().toISOString();
  audit(role, "Template archived", id, old, item.status, request);
  return item;
}

export function buildChartTemplatesResponse(role: Mt5Role = "Infrastructure Admin"): TemplateResponse {
  const now = new Date().toISOString();
  const issues = detectTemplateIssues(state.templates);
  const health = calculateTemplateHealth(state.templates);
  const published = state.templates.filter((item) => item.status === "Published");
  const active = state.templates.filter((item) => item.status !== "Archived");
  return {
    meta: { timestamp: now, currentRole: role, streamEndpoint: "/api/mt5/chart-templates/events-stream", monitoringMode: "Governed Template Registry" },
    kpis: [
      { label: "Active Templates", value: String(active.length), status: "Healthy", detail: "Non-archived presets" },
      { label: "Published", value: String(published.length), status: "Healthy", detail: "Approved versions" },
      { label: "In Review", value: String(state.templates.filter((item) => item.status === "In Review").length), status: "Watch", detail: "Approval queue" },
      { label: "Deployments", value: String(state.deployments.length), status: state.deployments.some((item) => item.status === "Degraded") ? "Degraded" : "Healthy", detail: "Workspace assignments" },
      { label: "Validation Issues", value: String(issues.length), status: issues.some((issue) => issue.severity === "Critical") ? "Critical" : "Watch", detail: "Governance checks" },
      { label: "Most Used", value: [...state.templates].sort((left, right) => right.usageCount - left.usageCount)[0].name, status: "Healthy", detail: "Adoption leader" },
      { label: "Library Health", value: `${health.score}/100`, status: health.score >= 75 ? "Healthy" : health.score >= 60 ? "Degraded" : "Critical", detail: health.rating },
      { label: "Audit Events", value: String(state.audits.length), status: "Healthy", detail: "Recorded changes" }
    ],
    templates: state.templates,
    deployments: state.deployments,
    issues,
    health,
    audits: state.audits,
    permissions: { role, canCreate: permissions.create.includes(role), canClone: permissions.clone.includes(role), canValidate: permissions.validate.includes(role), canPublish: permissions.publish.includes(role), canArchive: permissions.archive.includes(role) }
  };
}

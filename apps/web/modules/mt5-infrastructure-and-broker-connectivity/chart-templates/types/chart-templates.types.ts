import type { AuditRecord, Mt5Role } from "../../mt5-control-center/types/mt5-control-center.types";
import type { Timeframe } from "../../chart-control/types/chart-control.types";

export type TemplateTone = "Healthy" | "Watch" | "Degraded" | "Critical" | "Inactive";
export type TemplateSeverity = "Info" | "Warning" | "Critical";
export type TemplateStatus = "Published" | "Draft" | "In Review" | "Archived";

export type IndicatorPreset = {
  name: string;
  parameters: string;
  pane: "Overlay" | "Oscillator" | "Volume";
  color: string;
  required: boolean;
};

export type ChartTemplate = {
  id: string;
  name: string;
  description: string;
  category: "Execution" | "Analysis" | "Risk" | "Scalping" | "Swing" | "Data Quality";
  version: string;
  status: TemplateStatus;
  owner: string;
  visibility: "Private" | "Team" | "Institution";
  slots: number;
  symbols: string[];
  timeframes: Timeframe[];
  indicators: IndicatorPreset[];
  drawingTools: string[];
  colorTheme: string;
  candleStyle: string;
  riskOverlays: string[];
  alertRules: string[];
  usageCount: number;
  activeDeployments: number;
  lastValidatedAt: string;
  updatedAt: string;
  validationStatus: TemplateTone;
};

export type TemplateDeployment = {
  id: string;
  templateId: string;
  templateName: string;
  workspace: string;
  assignedTo: string;
  environment: "Live" | "Review" | "Simulation";
  status: TemplateTone;
  deployedAt: string;
  lastUsedAt: string;
};

export type TemplateIssue = {
  id: string;
  templateId: string;
  templateName: string;
  issueType: "Missing Indicator" | "Stale Validation" | "Unsafe Alert Rule" | "Offline Instrument" | "Version Conflict";
  severity: TemplateSeverity;
  detail: string;
  recommendation: string;
  detectedAt: string;
};

export type TemplateHealth = {
  score: number;
  rating: "Excellent" | "Healthy" | "Degraded" | "High Risk" | "Critical";
  factors: Record<string, number>;
};

export type TemplateResponse = {
  meta: { timestamp: string; currentRole: Mt5Role; streamEndpoint: string; monitoringMode: "Governed Template Registry" };
  kpis: Array<{ label: string; value: string; status: TemplateTone; detail: string }>;
  templates: ChartTemplate[];
  deployments: TemplateDeployment[];
  issues: TemplateIssue[];
  health: TemplateHealth;
  audits: AuditRecord[];
  permissions: {
    role: Mt5Role;
    canCreate: boolean;
    canClone: boolean;
    canValidate: boolean;
    canPublish: boolean;
    canArchive: boolean;
  };
};

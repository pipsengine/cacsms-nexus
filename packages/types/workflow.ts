export type WorkflowStatus =
  | "Operational"
  | "Running"
  | "Analyzing"
  | "Pending"
  | "Approved"
  | "Blocked"
  | "Warning"
  | "Critical"
  | "Learning"
  | "Recovering"
  | "Offline";

export type HealthState = "Nominal" | "Stable" | "Watch" | "Degraded" | "Blocked" | "Offline";

export type WorkflowColorType =
  | "blue"
  | "purple"
  | "green"
  | "red"
  | "orange"
  | "yellow"
  | "teal"
  | "indigo"
  | "pink"
  | "gray";

export type WorkflowStage = {
  stageNumber: number;
  title: string;
  description: string;
  status: WorkflowStatus;
  confidence: string;
  latency: string;
  health: HealthState;
  colorType: WorkflowColorType;
};

import type { Mt5Role, ScoreResult } from "@/modules/mt5-infrastructure-and-broker-connectivity/mt5-control-center/types/mt5-control-center.types";
import type { ConnectionHealthSummaryResponse } from "@/modules/mt5-infrastructure-and-broker-connectivity/connection-health/types/connection-health.types";
import type { EaBridgeResponse } from "@/modules/mt5-infrastructure-and-broker-connectivity/ea-bridge/types/ea-bridge.types";
import type { ExecutionQueueSummaryResponse } from "@/modules/mt5-infrastructure-and-broker-connectivity/execution-queue/types/execution-queue.types";
import type { RouterResponse } from "@/modules/mt5-infrastructure-and-broker-connectivity/order-router/types/order-router.types";
import type { TerminalStatusRecord, TerminalStatusResponse } from "@/modules/mt5-infrastructure-and-broker-connectivity/terminal-status/types/terminal-status.types";

export type OperatorTone = "Healthy" | "Watch" | "Degraded" | "Critical" | "Offline" | "Syncing" | "Inactive";

export type OperatorLaneId = "remote-control" | "desktop-automation" | "mt5-execution" | "recovery-safety";

export type OperatorLane = {
  id: OperatorLaneId;
  title: string;
  status: OperatorTone;
  readinessScore: number;
  blockedCount: number;
  activeAssets: number;
  detail: string;
  href: string;
};

export type OperatorSafetyState = {
  globalKillSwitchActive: boolean;
  routingEmergencyStop: boolean;
  queueEmergencyStop: boolean;
  unsafeTradingDisabled: boolean;
  autonomousPipelineHealthy: boolean;
  tradingPathSafe: boolean;
  failureReasons: string[];
};

export type OperatorHostSnapshot = {
  hostMachine: string;
  region: string;
  operatingSystem: string;
  terminalCount: number;
  healthyTerminals: number;
  averageCpuPercent: number;
  averageMemoryPercent: number;
  averageDiskPercent: number;
  averageLatencyMs: number;
  resourcePressureScore: number;
  status: OperatorTone;
  lastHeartbeatAt: string;
};

export type OperatorTerminalRow = {
  terminalId: string;
  terminalName: string;
  hostMachine: string;
  accountLogin: string;
  brokerName: string;
  processStatus: TerminalStatusRecord["processStatus"];
  connectionStatus: OperatorTone;
  heartbeatDelaySeconds: number;
  healthScore: number;
  readinessScore: number;
  tradingEnabled: boolean;
  restartRequired: boolean;
  maintenanceMode: boolean;
};

export type OperatorWarning = {
  id: string;
  severity: OperatorTone;
  source: string;
  title: string;
  detail: string;
};

export type OperatorWorkflowNode = {
  title: string;
  status: OperatorTone;
  assetCount: number;
  blockedCount: number;
  detail: string;
};

export type OperatorRecommendedAction = {
  id: string;
  priority: "Immediate" | "High" | "Normal";
  title: string;
  detail: string;
  href: string;
  automatedEligible: boolean;
};

export type OperatorTelemetryBundle = {
  terminalStatus: TerminalStatusResponse;
  eaBridge: EaBridgeResponse;
  connectionSummary: ConnectionHealthSummaryResponse;
  orderRouter: RouterResponse;
  executionQueue: ExecutionQueueSummaryResponse;
  unsafeTradingDisabled: boolean;
  connectionComponents?: ConnectionComponent[];
};

export type OperatorDashboardResponse = {
  meta: {
    timestamp: string;
    currentRole: Mt5Role;
    streamEndpoint: string;
    monitoringMode: string;
    highlightedHost: string | null;
    overallReadiness: ScoreResult;
  };
  kpis: Array<{ label: string; value: string; status: OperatorTone; detail: string; updatedAt: string }>;
  safety: OperatorSafetyState;
  lanes: OperatorLane[];
  workflow: OperatorWorkflowNode[];
  hosts: OperatorHostSnapshot[];
  terminals: OperatorTerminalRow[];
  warnings: OperatorWarning[];
  recommendedActions: OperatorRecommendedAction[];
  quickLinks: Array<{ label: string; href: string; description: string }>;
  permissions: {
    role: Mt5Role;
    canEmergencyStop: boolean;
    canAutoRemediate: boolean;
    canRestartTerminal: boolean;
    canManageRemoteControl: boolean;
  };
};

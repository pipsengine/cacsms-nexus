import type { AuditRecord, Mt5Role } from "../../mt5-control-center/types/mt5-control-center.types";

export type TerminalConnectionStatus = "Disconnected" | "Connecting" | "Connected" | "Error";
export type EaFolderLinkStatus = "Not Linked" | "Linked" | "Drifted" | "Missing Path";
export type TerminalTone = "Healthy" | "Watch" | "Degraded" | "Critical" | "Offline" | "Syncing" | "Inactive";
export type DriftStatus = "Missing in MT5" | "Missing in System" | "Size Mismatch" | "Hash Mismatch" | "Synced";
export type ChecklistStatus = "Complete" | "Pending" | "Attention" | "Blocked";

export type EaFolderFile = {
  name: string;
  relativePath: string;
  extension: string;
  sizeBytes: number;
  modifiedAt: string;
  contentHash: string | null;
};

export type EaFolderSnapshot = {
  root: string;
  expertsPath: string;
  includePath: string | null;
  exists: boolean;
  files: EaFolderFile[];
  fileCount: number;
  lastScannedAt: string;
  lastModifiedAt: string | null;
};

export type Mt5TerminalLink = {
  terminalId: string;
  terminalUuid: string | null;
  terminalName: string;
  brokerName: string;
  accountLogin: string;
  hostMachine: string;
  region: string;
  terminalExecutablePath: string;
  mt5DataPath: string | null;
  mt5DataRoot: string;
  mt5ExpertsPath: string;
  mt5IncludePath: string;
  connectionStatus: TerminalConnectionStatus;
  linkStatus: EaFolderLinkStatus;
  cacsmsEaRoot: string;
  linkedAt: string | null;
  lastConnectedAt: string | null;
  lastSyncAt: string | null;
  lastHeartbeatAt: string | null;
  healthScore: number;
  riskLevel: TerminalTone;
  autoLinkOnConnect: boolean;
  operatorManaged: boolean;
  isActive: boolean;
  driftFileCount: number;
  missingInMt5Count: number;
  missingInSystemCount: number;
  hashMismatchCount: number;
  bridgeChannelId: string | null;
  eaInstanceId: string | null;
  bridgeHeartbeatStatus: string | null;
  notes: string | null;
};

export type FolderDriftItem = {
  fileName: string;
  relativePath: string;
  status: DriftStatus;
  systemSizeBytes: number | null;
  mt5SizeBytes: number | null;
  systemHash: string | null;
  mt5Hash: string | null;
};

export type InstallChecklistItem = {
  step: string;
  status: ChecklistStatus;
  detail: string;
};

export type SyncPreviewItem = {
  relativePath: string;
  action: "Create" | "Update" | "Skip";
  reason: string;
};

export type EaTerminalHubPermissions = {
  role: Mt5Role;
  canScan: boolean;
  canConnect: boolean;
  canDisconnect: boolean;
  canLink: boolean;
  canSyncAll: boolean;
  canSetActive: boolean;
  canRegister: boolean;
  canPreviewSync: boolean;
};

export type EaTerminalHubSummary = {
  cacsmsEaRoot: string;
  systemFolder: EaFolderSnapshot;
  totalTerminals: number;
  connectedTerminals: number;
  linkedTerminals: number;
  driftedTerminals: number;
  managedTerminals: number;
  activeTerminalId: string | null;
  linkHealthScore: number;
  lastUpdatedAt: string;
};

export type EaTerminalHubResponse = {
  meta: { timestamp: string; currentRole: Mt5Role; streamEndpoint: string };
  summary: EaTerminalHubSummary;
  terminals: Mt5TerminalLink[];
  drift: FolderDriftItem[];
  workflow: Array<{ step: string; status: string; detail: string }>;
  installChecklist: InstallChecklistItem[];
  audits: AuditRecord[];
  permissions: EaTerminalHubPermissions;
};

export type ConnectTerminalsRequest = {
  terminalIds: string[];
  confirmed?: boolean;
  autoLink?: boolean;
};

export type LinkFolderRequest = {
  terminalId: string;
  confirmed?: boolean;
  mt5DataPath?: string;
  fileNames?: string[];
  relativePaths?: string[];
};

export type ActionResponse = {
  ok: boolean;
  message: string;
  terminal?: Mt5TerminalLink;
  terminals?: Mt5TerminalLink[];
  copiedFiles?: string[];
  preview?: SyncPreviewItem[];
  summary?: EaTerminalHubSummary;
};

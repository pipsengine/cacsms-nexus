import type { AuditRecord, Mt5Role } from "../../mt5-control-center/types/mt5-control-center.types";

export type TerminalConnectionStatus = "Disconnected" | "Connecting" | "Connected" | "Error";
export type EaFolderLinkStatus = "Not Linked" | "Linked" | "Drifted" | "Missing Path";
export type TerminalTone = "Healthy" | "Watch" | "Degraded" | "Critical" | "Offline" | "Syncing" | "Inactive";

export type EaFolderFile = {
  name: string;
  relativePath: string;
  extension: string;
  sizeBytes: number;
  modifiedAt: string;
};

export type EaFolderSnapshot = {
  root: string;
  expertsPath: string;
  exists: boolean;
  files: EaFolderFile[];
  fileCount: number;
  lastScannedAt: string;
  lastModifiedAt: string | null;
};

export type Mt5TerminalLink = {
  terminalId: string;
  terminalName: string;
  brokerName: string;
  accountLogin: string;
  hostMachine: string;
  region: string;
  terminalExecutablePath: string;
  mt5DataRoot: string;
  mt5ExpertsPath: string;
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
  isActive: boolean;
  driftFileCount: number;
  missingInMt5Count: number;
  missingInSystemCount: number;
  bridgeChannelId: string | null;
  notes: string | null;
};

export type FolderDriftItem = {
  fileName: string;
  status: "Missing in MT5" | "Missing in System" | "Size Mismatch" | "Synced";
  systemSizeBytes: number | null;
  mt5SizeBytes: number | null;
};

export type EaTerminalHubSummary = {
  cacsmsEaRoot: string;
  systemFolder: EaFolderSnapshot;
  totalTerminals: number;
  connectedTerminals: number;
  linkedTerminals: number;
  driftedTerminals: number;
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
  audits: AuditRecord[];
};

export type ConnectTerminalsRequest = {
  terminalIds: string[];
  confirmed?: boolean;
  autoLink?: boolean;
};

export type LinkFolderRequest = {
  terminalId: string;
  confirmed?: boolean;
  fileNames?: string[];
};

export type ActionResponse = {
  ok: boolean;
  message: string;
  terminal?: Mt5TerminalLink;
  terminals?: Mt5TerminalLink[];
  copiedFiles?: string[];
  summary?: EaTerminalHubSummary;
};

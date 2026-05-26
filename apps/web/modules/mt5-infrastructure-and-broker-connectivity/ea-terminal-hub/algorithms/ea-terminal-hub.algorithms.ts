import type {
  ChecklistStatus,
  DriftStatus,
  EaFolderFile,
  EaFolderLinkStatus,
  FolderDriftItem,
  InstallChecklistItem,
  Mt5TerminalLink,
  SyncPreviewItem,
  TerminalConnectionStatus,
  TerminalTone
} from "../types/ea-terminal-hub.types";

type BridgeHeartbeat = "Healthy" | "Watch" | "Degraded" | "Critical" | "Offline" | "Syncing" | "Inactive";

export function compareEaFolders(systemFiles: EaFolderFile[], mt5Files: EaFolderFile[]) {
  const systemMap = new Map(systemFiles.map((file) => [file.relativePath, file]));
  const mt5Map = new Map(mt5Files.map((file) => [file.relativePath, file]));
  const paths = new Set([...systemMap.keys(), ...mt5Map.keys()]);
  const drift: FolderDriftItem[] = [];
  let missingInMt5 = 0;
  let missingInSystem = 0;
  let mismatches = 0;
  let hashMismatches = 0;

  for (const relativePath of paths) {
    const system = systemMap.get(relativePath);
    const mt5 = mt5Map.get(relativePath);
    const fileName = relativePath.split("/").pop() ?? relativePath;

    if (system && !mt5) {
      missingInMt5 += 1;
      drift.push({
        fileName,
        relativePath,
        status: "Missing in MT5",
        systemSizeBytes: system.sizeBytes,
        mt5SizeBytes: null,
        systemHash: system.contentHash,
        mt5Hash: null
      });
      continue;
    }
    if (!system && mt5) {
      missingInSystem += 1;
      drift.push({
        fileName,
        relativePath,
        status: "Missing in System",
        systemSizeBytes: null,
        mt5SizeBytes: mt5.sizeBytes,
        systemHash: null,
        mt5Hash: mt5.contentHash
      });
      continue;
    }
    if (system && mt5 && system.sizeBytes !== mt5.sizeBytes) {
      mismatches += 1;
      drift.push({
        fileName,
        relativePath,
        status: "Size Mismatch",
        systemSizeBytes: system.sizeBytes,
        mt5SizeBytes: mt5.sizeBytes,
        systemHash: system.contentHash,
        mt5Hash: mt5.contentHash
      });
      continue;
    }
    if (system && mt5 && system.contentHash && mt5.contentHash && system.contentHash !== mt5.contentHash) {
      hashMismatches += 1;
      drift.push({
        fileName,
        relativePath,
        status: "Hash Mismatch",
        systemSizeBytes: system.sizeBytes,
        mt5SizeBytes: mt5.sizeBytes,
        systemHash: system.contentHash,
        mt5Hash: mt5.contentHash
      });
      continue;
    }
    if (system && mt5) {
      drift.push({
        fileName,
        relativePath,
        status: "Synced",
        systemSizeBytes: system.sizeBytes,
        mt5SizeBytes: mt5.sizeBytes,
        systemHash: system.contentHash,
        mt5Hash: mt5.contentHash
      });
    }
  }

  return { drift, missingInMt5, missingInSystem, mismatches, hashMismatches };
}

export function resolveLinkStatus(
  mt5PathExists: boolean,
  missingInMt5: number,
  missingInSystem: number,
  mismatches: number,
  hashMismatches: number,
  linkedAt: string | null
): EaFolderLinkStatus {
  if (!mt5PathExists) return "Missing Path";
  if (!linkedAt && missingInMt5 > 0) return "Not Linked";
  if (missingInMt5 > 0 || missingInSystem > 0 || mismatches > 0 || hashMismatches > 0) return "Drifted";
  return "Linked";
}

export function resolveConnectionFromBridge(heartbeatStatus: BridgeHeartbeat | null | undefined): TerminalConnectionStatus {
  if (!heartbeatStatus || heartbeatStatus === "Offline" || heartbeatStatus === "Inactive") return "Disconnected";
  if (heartbeatStatus === "Syncing") return "Connecting";
  if (heartbeatStatus === "Critical") return "Error";
  return "Connected";
}

export function resolveConnectionFromMonitor(
  heartbeatStatus: BridgeHeartbeat | null | undefined,
  processStatus: string
): TerminalConnectionStatus {
  if (processStatus === "Stopped") return "Disconnected";
  return resolveConnectionFromBridge(heartbeatStatus);
}

export function linkHealthScore(terminals: Mt5TerminalLink[]) {
  if (!terminals.length) return 0;
  const connectedWeight = terminals.filter((t) => t.connectionStatus === "Connected").length / terminals.length;
  const linkedWeight = terminals.filter((t) => t.linkStatus === "Linked").length / terminals.length;
  const driftPenalty = terminals.filter((t) => t.linkStatus === "Drifted").length / terminals.length;
  const score = Math.round((connectedWeight * 45 + linkedWeight * 45 + (1 - driftPenalty) * 10) * 100);
  return Math.max(0, Math.min(100, score));
}

export function riskFromHealth(score: number): TerminalTone {
  if (score >= 80) return "Healthy";
  if (score >= 60) return "Watch";
  if (score >= 40) return "Degraded";
  return "Critical";
}

export function buildWorkflow(terminals: Mt5TerminalLink[]) {
  const connected = terminals.filter((t) => t.connectionStatus === "Connected").length;
  const linked = terminals.filter((t) => t.linkStatus === "Linked").length;
  const managed = terminals.filter((t) => t.operatorManaged).length;
  return [
    { step: "Scan Cacsms EA folder", status: "Complete", detail: "System Experts and Include directories indexed." },
    { step: "Discover MT5 terminals", status: "Complete", detail: `${terminals.length} terminal profile(s) available.` },
    { step: "Operator-managed terminals", status: managed ? "Active" : "Pending", detail: `${managed} terminal(s) under active hub management.` },
    { step: "Bridge connectivity", status: connected ? "Active" : "Pending", detail: `${connected} terminal(s) reporting live EA bridge heartbeats.` },
    { step: "Link Experts folders", status: linked ? "Active" : "Pending", detail: `${linked} terminal(s) linked to Cacsms EA artifacts.` },
    {
      step: "Drift reconciliation",
      status: terminals.some((t) => t.linkStatus === "Drifted") ? "Attention" : "Clear",
      detail: "Compare canonical system payloads against each MT5 Experts directory."
    }
  ];
}

export function buildInstallChecklist(terminal: Mt5TerminalLink | null, systemFileCount: number): InstallChecklistItem[] {
  if (!terminal) {
    return [{ step: "Select terminal", status: "Pending", detail: "Focus a terminal to view its EA install checklist." }];
  }

  const items: InstallChecklistItem[] = [
    {
      step: "Canonical EA artifacts available",
      status: systemFileCount > 0 ? "Complete" : "Blocked",
      detail: systemFileCount > 0 ? `${systemFileCount} artifact(s) indexed in the Cacsms EA folder.` : "Add `.mq5` / `.ex5` files under the system Experts directory."
    },
    {
      step: "MT5 Experts path resolved",
      status: terminal.linkStatus === "Missing Path" ? "Blocked" : "Complete",
      detail: terminal.mt5ExpertsPath
    },
    {
      step: "EA folder linked to terminal",
      status: terminal.linkStatus === "Linked" ? "Complete" : terminal.linkStatus === "Drifted" ? "Attention" : "Pending",
      detail:
        terminal.linkStatus === "Linked"
          ? "System and terminal Experts payloads are synchronized."
          : terminal.linkStatus === "Drifted"
            ? `${terminal.driftFileCount} drift item(s) require reconciliation.`
            : "Run Link EA or Connect with auto-link enabled."
    },
    {
      step: "Bridge instance provisioned",
      status: terminal.eaInstanceId ? "Complete" : "Pending",
      detail: terminal.eaInstanceId ? `Instance ${terminal.eaInstanceId} registered in EA Bridge.` : "Complete MT5 Control Center terminal onboarding first."
    },
    {
      step: "Verified EA heartbeat",
      status:
        terminal.connectionStatus === "Connected"
          ? "Complete"
          : terminal.connectionStatus === "Connecting"
            ? "Attention"
            : "Pending",
      detail:
        terminal.lastHeartbeatAt && terminal.connectionStatus === "Connected"
          ? `Last heartbeat ${new Date(terminal.lastHeartbeatAt).toLocaleString()}.`
          : "Attach NexusBridgeEA to a chart with onboarding credentials and allow WebRequest for the Nexus origin."
    }
  ];

  return items;
}

export function buildSyncPreview(systemFiles: EaFolderFile[], mt5Files: EaFolderFile[]): SyncPreviewItem[] {
  const comparison = compareEaFolders(systemFiles, mt5Files);
  return comparison.drift
    .filter((item) => item.status !== "Synced" && item.status !== "Missing in System")
    .map((item) => ({
      relativePath: item.relativePath,
      action: item.status === "Missing in MT5" ? "Create" : "Update",
      reason: item.status
    }));
}

export function validateTerminalRegistration(input: {
  terminalName: string;
  terminalExecutablePath: string;
  brokerName: string;
  accountLogin: string;
}) {
  if (!input.terminalName.trim()) throw new Error("Terminal name is required.");
  if (!input.terminalExecutablePath.trim()) throw new Error("Terminal executable path is required.");
  if (!/terminal64\.exe$/i.test(input.terminalExecutablePath.trim())) {
    throw new Error("Terminal executable path must end with terminal64.exe.");
  }
  if (!input.brokerName.trim()) throw new Error("Broker name is required.");
  if (!/^\d{5,12}$/.test(input.accountLogin.trim())) {
    throw new Error("Account login must be a numeric MT5 account identifier.");
  }
}

export function checklistTone(status: ChecklistStatus): "success" | "warning" | "destructive" | "secondary" {
  if (status === "Complete") return "success";
  if (status === "Attention") return "warning";
  if (status === "Blocked") return "destructive";
  return "secondary";
}

export function driftTone(status: DriftStatus): "success" | "warning" | "destructive" | "secondary" {
  if (status === "Synced") return "success";
  if (status === "Missing in System") return "warning";
  if (status === "Hash Mismatch" || status === "Size Mismatch") return "warning";
  return "destructive";
}

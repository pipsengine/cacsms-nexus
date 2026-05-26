import type { EaFolderFile, EaFolderLinkStatus, FolderDriftItem, Mt5TerminalLink, TerminalTone } from "../types/ea-terminal-hub.types";

export function compareEaFolders(systemFiles: EaFolderFile[], mt5Files: EaFolderFile[]) {
  const systemMap = new Map(systemFiles.map((file) => [file.name, file]));
  const mt5Map = new Map(mt5Files.map((file) => [file.name, file]));
  const names = new Set([...systemMap.keys(), ...mt5Map.keys()]);
  const drift: FolderDriftItem[] = [];
  let missingInMt5 = 0;
  let missingInSystem = 0;
  let mismatches = 0;

  for (const fileName of names) {
    const system = systemMap.get(fileName);
    const mt5 = mt5Map.get(fileName);
    if (system && !mt5) {
      missingInMt5 += 1;
      drift.push({ fileName, status: "Missing in MT5", systemSizeBytes: system.sizeBytes, mt5SizeBytes: null });
      continue;
    }
    if (!system && mt5) {
      missingInSystem += 1;
      drift.push({ fileName, status: "Missing in System", systemSizeBytes: null, mt5SizeBytes: mt5.sizeBytes });
      continue;
    }
    if (system && mt5 && system.sizeBytes !== mt5.sizeBytes) {
      mismatches += 1;
      drift.push({ fileName, status: "Size Mismatch", systemSizeBytes: system.sizeBytes, mt5SizeBytes: mt5.sizeBytes });
      continue;
    }
    if (system && mt5) {
      drift.push({ fileName, status: "Synced", systemSizeBytes: system.sizeBytes, mt5SizeBytes: mt5.sizeBytes });
    }
  }

  return { drift, missingInMt5, missingInSystem, mismatches };
}

export function resolveLinkStatus(
  mt5PathExists: boolean,
  missingInMt5: number,
  missingInSystem: number,
  mismatches: number,
  linkedAt: string | null
): EaFolderLinkStatus {
  if (!mt5PathExists) return "Missing Path";
  if (!linkedAt && missingInMt5 > 0) return "Not Linked";
  if (missingInMt5 > 0 || missingInSystem > 0 || mismatches > 0) return "Drifted";
  return "Linked";
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
  return [
    { step: "Scan Cacsms EA folder", status: "Complete", detail: "System Experts directory indexed." },
    { step: "Discover MT5 terminals", status: "Complete", detail: `${terminals.length} terminal profiles available.` },
    { step: "Multi-terminal connect", status: connected ? "Active" : "Pending", detail: `${connected} terminal(s) connected.` },
    { step: "Link Experts folders", status: linked ? "Active" : "Pending", detail: `${linked} terminal(s) linked to Cacsms EA.` },
    { step: "Drift reconciliation", status: terminals.some((t) => t.linkStatus === "Drifted") ? "Attention" : "Clear", detail: "Compare system vs MT5 EA payloads." }
  ];
}

import path from "node:path";

const DEFAULT_CACSMS_EA_ROOT = "C:\\Next-Generation\\cacsms-nexus\\services\\cacsms-ea";

export function resolveCacsmsEaRoot() {
  return path.resolve(process.env.CACSMS_EA_ROOT ?? DEFAULT_CACSMS_EA_ROOT);
}

export function resolveRepoBridgeEaSourceCandidates() {
  const repoFromEnv = process.env.CACSMS_REPO_ROOT;
  const cacsmsEaExperts = path.join(resolveCacsmsEaRoot(), "Experts", "NexusBridgeEA", "NexusBridgeEA.mq5");
  return [
    cacsmsEaExperts,
    repoFromEnv ? path.join(repoFromEnv, "services", "cacsms-ea", "Experts", "NexusBridgeEA", "NexusBridgeEA.mq5") : null,
    path.resolve(process.cwd(), "..", "..", "services", "cacsms-ea", "Experts", "NexusBridgeEA", "NexusBridgeEA.mq5"),
    repoFromEnv ? path.join(repoFromEnv, "mt5", "expert-advisors", "NexusBridgeEA", "NexusBridgeEA.mq5") : null,
    path.resolve(process.cwd(), "..", "..", "mt5", "expert-advisors", "NexusBridgeEA", "NexusBridgeEA.mq5"),
    path.resolve(process.cwd(), "mt5", "expert-advisors", "NexusBridgeEA", "NexusBridgeEA.mq5"),
    "C:\\Next-Generation\\cacsms-nexus\\mt5\\expert-advisors\\NexusBridgeEA\\NexusBridgeEA.mq5",
    path.join(resolveCacsmsEaRoot(), "Experts", "NexusBridgeEA.mq5")
  ].filter(Boolean) as string[];
}

export function resolveRepoBridgeEaSource() {
  return resolveRepoBridgeEaSourceCandidates()[0];
}

export type Mt5FolderLayout = {
  mt5DataRoot: string;
  mt5ExpertsPath: string;
  mt5IncludePath: string;
};

export function normalizeMt5DataRoot(mt5DataPath: string) {
  let normalized = path.resolve(mt5DataPath.trim());
  normalized = normalized.replace(/[\\/]+MQL5[\\/]+(Experts|Include)[\\/]*$/i, "");
  normalized = normalized.replace(/[\\/]+MQL5[\\/]*$/i, "");
  return normalized;
}

export function resolveMt5FolderLayout(options: {
  terminalExecutablePath: string;
  mt5DataPath?: string | null;
}): Mt5FolderLayout {
  const explicit = options.mt5DataPath?.trim();
  const mt5DataRoot = explicit
    ? normalizeMt5DataRoot(explicit)
    : path.dirname(path.resolve(options.terminalExecutablePath));

  return {
    mt5DataRoot,
    mt5ExpertsPath: path.join(mt5DataRoot, "MQL5", "Experts"),
    mt5IncludePath: path.join(mt5DataRoot, "MQL5", "Include")
  };
}

export function assertWritableMt5Target(targetPath: string) {
  const resolved = path.resolve(targetPath);
  if (/\\Program Files( \(x86\))?\\/i.test(resolved)) {
    throw new Error(
      "Cannot write EA files under Program Files. In MT5 choose File → Open Data Folder and register that AppData path as the MT5 data path (MetaQuotes\\Terminal\\<id>), then link again."
    );
  }
}

/** @deprecated Prefer resolveMt5FolderLayout with mt5DataPath for standard broker installs. */
export function deriveMt5ExpertsPath(terminalExecutablePath: string, mt5DataPath?: string | null) {
  return resolveMt5FolderLayout({ terminalExecutablePath, mt5DataPath }).mt5ExpertsPath;
}

/** @deprecated Prefer resolveMt5FolderLayout with mt5DataPath for standard broker installs. */
export function deriveMt5IncludePath(terminalExecutablePath: string, mt5DataPath?: string | null) {
  return resolveMt5FolderLayout({ terminalExecutablePath, mt5DataPath }).mt5IncludePath;
}

/** @deprecated Prefer resolveMt5FolderLayout with mt5DataPath for standard broker installs. */
export function deriveMt5DataRoot(terminalExecutablePath: string, mt5DataPath?: string | null) {
  return resolveMt5FolderLayout({ terminalExecutablePath, mt5DataPath }).mt5DataRoot;
}

export function deriveMt5IncludePathFromExperts(mt5ExpertsPath: string) {
  return path.join(path.dirname(mt5ExpertsPath), "Include");
}

export function toPosixRelative(relativePath: string) {
  return relativePath.replace(/\\/g, "/");
}

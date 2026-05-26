import path from "node:path";

const DEFAULT_CACSMS_EA_ROOT = "C:\\Next-Generation\\cacsms-nexus\\services\\cacsms-ea";

export function resolveCacsmsEaRoot() {
  return path.resolve(process.env.CACSMS_EA_ROOT ?? DEFAULT_CACSMS_EA_ROOT);
}

export function resolveRepoBridgeEaSourceCandidates() {
  const repoFromEnv = process.env.CACSMS_REPO_ROOT;
  return [
    repoFromEnv ? path.join(repoFromEnv, "mt5", "expert-advisors", "NexusBridgeEA.mq5") : null,
    path.resolve(process.cwd(), "..", "..", "mt5", "expert-advisors", "NexusBridgeEA.mq5"),
    path.resolve(process.cwd(), "mt5", "expert-advisors", "NexusBridgeEA.mq5"),
    "C:\\Next-Generation\\cacsms-nexus\\mt5\\expert-advisors\\NexusBridgeEA.mq5"
  ].filter(Boolean) as string[];
}

export function resolveRepoBridgeEaSource() {
  return resolveRepoBridgeEaSourceCandidates()[0];
}

export function deriveMt5ExpertsPath(terminalExecutablePath: string) {
  const normalized = path.resolve(terminalExecutablePath);
  const terminalDir = path.dirname(normalized);
  return path.join(terminalDir, "MQL5", "Experts");
}

export function deriveMt5IncludePath(terminalExecutablePath: string) {
  return path.join(path.dirname(deriveMt5ExpertsPath(terminalExecutablePath)), "Include");
}

export function deriveMt5IncludePathFromExperts(mt5ExpertsPath: string) {
  return path.join(path.dirname(mt5ExpertsPath), "Include");
}

export function deriveMt5DataRoot(terminalExecutablePath: string) {
  return path.dirname(path.resolve(terminalExecutablePath));
}

export function toPosixRelative(relativePath: string) {
  return relativePath.replace(/\\/g, "/");
}

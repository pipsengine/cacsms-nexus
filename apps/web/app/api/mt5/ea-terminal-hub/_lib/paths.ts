import path from "node:path";

const DEFAULT_CACSMS_EA_ROOT = "C:\\Next-Generation\\cacsms-nexus\\services\\cacsms-ea";

export function resolveCacsmsEaRoot() {
  return path.resolve(process.env.CACSMS_EA_ROOT ?? DEFAULT_CACSMS_EA_ROOT);
}

export function deriveMt5ExpertsPath(terminalExecutablePath: string) {
  const terminalDir = path.dirname(terminalExecutablePath);
  return path.join(terminalDir, "MQL5", "Experts");
}

export function deriveMt5DataRoot(terminalExecutablePath: string) {
  return path.dirname(terminalExecutablePath);
}

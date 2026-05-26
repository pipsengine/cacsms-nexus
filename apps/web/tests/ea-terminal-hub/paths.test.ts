import { describe, expect, it } from "vitest";

import {
  assertWritableMt5Target,
  normalizeMt5DataRoot,
  resolveMt5FolderLayout
} from "@/app/api/mt5/ea-terminal-hub/_lib/paths";

describe("MT5 folder path resolution", () => {
  it("uses AppData data root when mt5DataPath is provided", () => {
    const layout = resolveMt5FolderLayout({
      terminalExecutablePath: "C:\\Program Files\\MetaTrader 5 IC Markets Global\\terminal64.exe",
      mt5DataPath: "C:\\Users\\demo\\AppData\\Roaming\\MetaQuotes\\Terminal\\ABC123"
    });
    expect(layout.mt5ExpertsPath).toBe("C:\\Users\\demo\\AppData\\Roaming\\MetaQuotes\\Terminal\\ABC123\\MQL5\\Experts");
    expect(layout.mt5IncludePath).toBe("C:\\Users\\demo\\AppData\\Roaming\\MetaQuotes\\Terminal\\ABC123\\MQL5\\Include");
  });

  it("normalizes MQL5 subpaths to the terminal data root", () => {
    expect(normalizeMt5DataRoot("C:\\Users\\demo\\AppData\\Roaming\\MetaQuotes\\Terminal\\ABC123\\MQL5\\Experts")).toBe(
      "C:\\Users\\demo\\AppData\\Roaming\\MetaQuotes\\Terminal\\ABC123"
    );
  });

  it("blocks Program Files write targets", () => {
    expect(() => assertWritableMt5Target("C:\\Program Files\\MetaTrader 5\\MQL5\\Experts")).toThrow(/Program Files/);
  });
});

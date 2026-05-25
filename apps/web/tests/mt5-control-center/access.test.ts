import { afterEach, describe, expect, it, vi } from "vitest";

import { resolveMt5Role } from "@/app/api/mt5/_lib/access";

afterEach(() => vi.unstubAllEnvs());

describe("MT5 operator access resolution", () => {
  it("allows explicitly configured local operator mode in development", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("MT5_LOCAL_OPERATOR_MODE", "true");
    vi.stubEnv("MT5_LOCAL_OPERATOR_ROLE", "Infrastructure Admin");
    expect(resolveMt5Role(new Request("http://localhost/api/mt5"))).toBe("Infrastructure Admin");
  });

  it("ignores role headers and local operator settings in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("MT5_LOCAL_OPERATOR_MODE", "true");
    vi.stubEnv("MT5_LOCAL_OPERATOR_ROLE", "Infrastructure Admin");
    expect(resolveMt5Role(new Request("https://nexus.example/api/mt5", { headers: { "x-mt5-role": "Super Admin" } }))).toBe("Read-Only Viewer");
  });
});

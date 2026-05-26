import { describe, expect, it } from "vitest";

import {
  EaIngestionAuthError,
  extractIngestionToken,
  hashIngestionToken,
  normalizeIngestionToken,
  tokenSafeFingerprint
} from "@/app/api/mt5/ea-bridge/_lib/ingestion-auth";

describe("EA ingestion token normalization", () => {
  it("extracts tokens from supported headers and body fields with trimming", () => {
    const fromHeader = extractIngestionToken(
      new Request("http://localhost/api/mt5/ea-bridge/ingest/heartbeat", {
        headers: { "x-ingestion-token": "  header-token  " }
      })
    );
    expect(fromHeader).toEqual({ token: "header-token", source: "x-ingestion-token" });

    const fromBearer = extractIngestionToken(
      new Request("http://localhost/api/mt5/ea-bridge/ingest/heartbeat", {
        headers: { authorization: "Bearer bearer-token" }
      })
    );
    expect(fromBearer.token).toBe("bearer-token");

    const fromBody = extractIngestionToken(new Request("http://localhost/api/mt5/ea-bridge/ingest/heartbeat"), {
      IngestionToken: " body-token "
    });
    expect(fromBody).toEqual({ token: "body-token", source: "body.IngestionToken" });
  });

  it("hashes normalized tokens consistently", () => {
    const raw = " Bearer abc-token \u200b";
    expect(hashIngestionToken(raw)).toBe(hashIngestionToken(normalizeIngestionToken(raw)));
    expect(tokenSafeFingerprint(raw)).toEqual({ length: 9, prefix: "abc-", suffix: "oken" });
  });
});

describe("EA ingestion auth errors", () => {
  it("carries structured error codes and diagnostics", () => {
    const error = new EaIngestionAuthError("token_mismatch", "Token mismatch", {
      endpoint: "ingest/heartbeat",
      matchedEaInstanceId: "ea-ld4-01",
      accountNumber: "73018421",
      broker: "IC Markets",
      received: { length: 9, prefix: "abc-", suffix: "oken" },
      expected: { length: 64, prefix: "dead", suffix: "beef" },
      tokenSource: "authorization"
    });
    expect(error.code).toBe("token_mismatch");
    expect(error.diagnostics.matchedEaInstanceId).toBe("ea-ld4-01");
  });
});

import { createHash } from "node:crypto";

export type EaIngestionAuthErrorCode =
  | "token_missing"
  | "token_mismatch"
  | "signing_secret_mismatch"
  | "ea_instance_not_found"
  | "pairing_revoked"
  | "account_mismatch"
  | "terminal_mismatch";

export type EaIngestionTokenFingerprint = {
  length: number;
  prefix: string;
  suffix: string;
};

export type EaIngestionAuthDiagnostics = {
  endpoint: string;
  matchedEaInstanceId: string | null;
  accountNumber: string | null;
  broker: string | null;
  received: EaIngestionTokenFingerprint | null;
  expected: EaIngestionTokenFingerprint | null;
  tokenSource: string | null;
};

export class EaIngestionAuthError extends Error {
  readonly code: EaIngestionAuthErrorCode;
  readonly diagnostics: EaIngestionAuthDiagnostics;

  constructor(code: EaIngestionAuthErrorCode, message: string, diagnostics: EaIngestionAuthDiagnostics) {
    super(message);
    this.name = "EaIngestionAuthError";
    this.code = code;
    this.diagnostics = diagnostics;
  }
}

const TOKEN_BODY_KEYS = ["ingestionToken", "IngestionToken", "token", "Token"] as const;

export function normalizeIngestionToken(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw
    .trim()
    .replace(/^Bearer\s+/i, "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim();
}

export function hashIngestionToken(token: string): string {
  const normalized = normalizeIngestionToken(token);
  if (!normalized) return "";
  return createHash("sha256").update(normalized).digest("hex");
}

export function tokenSafeFingerprint(token: string): EaIngestionTokenFingerprint {
  const normalized = normalizeIngestionToken(token);
  if (!normalized) {
    return { length: 0, prefix: "", suffix: "" };
  }
  const visible = Math.min(4, normalized.length);
  return {
    length: normalized.length,
    prefix: normalized.slice(0, visible),
    suffix: normalized.slice(-visible)
  };
}

export function fingerprintFromHash(hash: string): EaIngestionTokenFingerprint {
  if (!hash) return { length: 0, prefix: "", suffix: "" };
  return {
    length: hash.length,
    prefix: hash.slice(0, 4),
    suffix: hash.slice(-4)
  };
}

function readBodyToken(body?: Record<string, unknown>) {
  if (!body) return { token: "", source: null as string | null };
  for (const key of TOKEN_BODY_KEYS) {
    const candidate = normalizeIngestionToken(body[key]);
    if (candidate) return { token: candidate, source: `body.${key}` };
  }
  return { token: "", source: null };
}

export function extractIngestionToken(request: Request, body?: Record<string, unknown>) {
  const headerToken = normalizeIngestionToken(request.headers.get("x-ingestion-token"));
  if (headerToken) {
    return { token: headerToken, source: "x-ingestion-token" };
  }

  const authorization = request.headers.get("authorization");
  if (authorization) {
    const bearerToken = authorization.startsWith("Bearer ")
      ? normalizeIngestionToken(authorization.slice(7))
      : normalizeIngestionToken(authorization);
    if (bearerToken) {
      return { token: bearerToken, source: "authorization" };
    }
  }

  const bodyToken = readBodyToken(body);
  if (bodyToken.token) {
    return bodyToken;
  }

  return { token: "", source: null };
}

export function ingestionAuthDebugEnabled() {
  return process.env.MT5_EA_INGESTION_DEBUG === "true" || process.env.MT5_LOCAL_OPERATOR_MODE === "true";
}

export function logEaIngestionAuthDiagnostics(
  details: EaIngestionAuthDiagnostics & ({ outcome: "accepted" } | { outcome: "rejected"; code: EaIngestionAuthErrorCode })
) {
  if (!ingestionAuthDebugEnabled()) return;
  console.info("[ea-bridge-ingest-auth]", JSON.stringify(details));
}

export function normalizeAccountLogin(value: unknown) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

export function normalizeBindingKey(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

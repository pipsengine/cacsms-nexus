import type { EaBridgeResponse, EaIngestionAuthDiagnostics, EaIngestionTokenFingerprint, EaPairingTestResult } from "../types/ea-bridge.types";

export class EaBridgeActionError extends Error {
  code?: EaPairingTestResult["code"];
  diagnostics?: EaIngestionAuthDiagnostics;

  constructor(message: string, code?: EaPairingTestResult["code"], diagnostics?: EaIngestionAuthDiagnostics) {
    super(message);
    this.name = "EaBridgeActionError";
    this.code = code;
    this.diagnostics = diagnostics;
  }
}

export async function fetchEaBridge() {
  const response = await fetch("/api/mt5/ea-bridge", { cache: "no-store" });
  if (!response.ok) throw new Error("Unable to load EA Bridge status.");
  return (await response.json()) as EaBridgeResponse;
}

export async function runEaBridgeAction(path: string, body: Record<string, unknown> = { confirmed: true }) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  const payload = (await response.json()) as EaPairingTestResult & {
    error?: string;
    code?: EaPairingTestResult["code"];
    diagnostics?: EaIngestionAuthDiagnostics;
  };
  if (!response.ok) {
    throw new EaBridgeActionError(
      payload.error ?? "EA Bridge operation failed.",
      payload.code,
      payload.diagnostics
    );
  }
  return payload;
}

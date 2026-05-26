import type { SignedBridgeEnvelope, TerminalMessageType } from "@/modules/mt5-infrastructure-and-broker-connectivity/ea-bridge/types/ea-bridge.types";

import { normalizeAccountLogin } from "./ingestion-auth";

const ENDPOINT_BY_TYPE: Partial<Record<TerminalMessageType, string>> = {
  Heartbeat: "ingest/heartbeat",
  "Account Snapshot": "ingest/account-snapshot",
  "Position Update": "ingest/positions",
  "Pending Order Update": "ingest/orders",
  "Command Poll": "instances/pending-commands",
  "Trade Execution Result": "instances/command-ack"
};

export type EaIngestBody = SignedBridgeEnvelope & Record<string, unknown>;

export function parseEaIngestBody(raw: unknown): EaIngestBody {
  return (raw ?? {}) as EaIngestBody;
}

export function ingestEndpointName(messageType?: TerminalMessageType, fallback = "ingest/unknown") {
  if (!messageType) return fallback;
  return ENDPOINT_BY_TYPE[messageType] ?? fallback;
}

export function readIngestBindingHints(body?: Record<string, unknown>) {
  const record = body ?? {};
  let accountLogin = normalizeAccountLogin(record.accountLogin ?? record.accountNumber ?? record.account);
  let brokerServer = normalizeAccountLogin(record.brokerServer ?? record.serverName ?? record.broker);
  let terminalId = normalizeAccountLogin(record.terminalId ?? record.terminalUuid);
  let instanceId = normalizeAccountLogin(record.instanceId ?? record.eaInstanceId);

  if (typeof record.payloadJson === "string" && record.payloadJson.trim()) {
    try {
      const payload = JSON.parse(record.payloadJson) as Record<string, unknown>;
      accountLogin ||= normalizeAccountLogin(payload.accountLogin ?? payload.accountNumber);
      brokerServer ||= normalizeAccountLogin(payload.brokerServer ?? payload.serverName);
      terminalId ||= normalizeAccountLogin(payload.terminalId ?? payload.terminalUuid);
    } catch {
      // Ignore malformed payload hints during auth.
    }
  }

  return { accountLogin: accountLogin || undefined, brokerServer: brokerServer || undefined, terminalId: terminalId || undefined, instanceId: instanceId || undefined };
}

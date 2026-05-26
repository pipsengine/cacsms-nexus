import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { ingestTerminalAccountSnapshot, ingestTerminalPendingOrderUpdates, ingestTerminalPositionUpdates } from "@/app/api/mt5/account-sync/_lib/store";
import { activateRegisteredTerminalFromHeartbeat } from "@/app/api/mt5/_lib/store";
import { recordVerifiedTerminalHeartbeat } from "@/app/api/mt5/terminal-status/_lib/store";
import type { AuditRecord, Mt5Role, Terminal } from "@/modules/mt5-infrastructure-and-broker-connectivity/mt5-control-center/types/mt5-control-center.types";
import {
  calculateBridgeHealth,
  calculateDeliveryReliability,
  canDeliverTradeCommand,
  classifyTokenRisk,
  isDuplicateCommand,
  validateBridgePayload
} from "@/modules/mt5-infrastructure-and-broker-connectivity/ea-bridge/algorithms/ea-bridge.algorithms";
import { createEaBridgeSeed } from "@/modules/mt5-infrastructure-and-broker-connectivity/ea-bridge/data/ea-bridge.mock";
import type {
  BridgeDiagnostic,
  BridgeLog,
  BridgeMessage,
  BridgeSession,
  EaBridgeResponse,
  EaInstance,
  EaPairingReceipt,
  SignedBridgeEnvelope,
  TerminalAccountSnapshotPayload,
  TerminalExecutionFeedbackPayload,
  TerminalHeartbeatPayload,
  TerminalPendingOrderUpdatePayload,
  TerminalPositionUpdatePayload,
  TerminalMessageType,
  TradeCommand
} from "@/modules/mt5-infrastructure-and-broker-connectivity/ea-bridge/types/ea-bridge.types";
import { resolveMt5Role } from "../../_lib/access";
import { getTerminals } from "../../_lib/store";
import { bindPersistedMt5State } from "../../_lib/persistence";
import { ingestEndpointName, readIngestBindingHints } from "./ingest-request";
import {
  EaIngestionAuthError,
  extractIngestionToken,
  fingerprintFromHash,
  hashIngestionToken,
  logEaIngestionAuthDiagnostics,
  normalizeAccountLogin,
  normalizeBindingKey,
  normalizeIngestionToken,
  tokenSafeFingerprint,
  type EaIngestionAuthDiagnostics,
  type EaIngestionAuthErrorCode,
  type EaIngestionTokenFingerprint
} from "./ingestion-auth";

const seed = createEaBridgeSeed();
const state = bindPersistedMt5State("ea-bridge", () => ({
  ...seed,
  audits: [] as AuditRecord[],
  lastSyncAt: new Date().toISOString(),
  usedNonces: new Set(seed.messages.map((message) => message.nonce)),
  issuedCredentialSecrets: { ...seed.issuedCredentialSecrets }
}));

function ensureCredentialStore() {
  if (!state.issuedCredentialSecrets || typeof state.issuedCredentialSecrets !== "object") {
    state.issuedCredentialSecrets = {};
  }
}

function isLocalDevOperatorMode() {
  return process.env.MT5_LOCAL_OPERATOR_MODE === "true";
}

export function eaBridgePublicBaseUrl(request?: Request) {
  const configured = process.env.MT5_EA_BRIDGE_PUBLIC_URL?.trim().replace(/\/+$/, "");
  if (configured) return configured;
  if (isLocalDevOperatorMode()) return "http://127.0.0.1:3000";
  return request ? new URL(request.url).origin : "http://127.0.0.1:3000";
}

function localDevIngestionToken() {
  return normalizeIngestionToken(process.env.MT5_EA_INGESTION_TOKEN ?? process.env.MT5_EA_INGESTION_SECRET ?? "");
}

function localDevSigningSecret(instanceId: string) {
  const instanceKey = `MT5_EA_SIGNING_SECRET_${instanceId.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`;
  return normalizeIngestionToken(process.env[instanceKey] ?? process.env.MT5_EA_SIGNING_SECRET ?? "");
}

function ensureLocalDevCredentialAlignment(instanceId: string) {
  if (!isLocalDevOperatorMode()) return;
  const ingestionToken = localDevIngestionToken();
  const signingSecret = localDevSigningSecret(instanceId);
  if (!ingestionToken || !signingSecret) return;
  storeCredentialSecrets(instanceId, {
    ingestionTokenHash: hashIngestionToken(ingestionToken),
    signingSecret,
    ingestionTokenPlaintext: ingestionToken,
    signingSecretPlaintext: signingSecret
  });
}

function ensureUsedNonces() {
  if (state.usedNonces instanceof Set) return;
  const raw = state.usedNonces as { values?: string[] } | null;
  state.usedNonces = new Set(Array.isArray(raw?.values) ? raw.values : state.messages.map((message) => message.nonce));
}

function credentialSecrets(instanceId: string) {
  ensureCredentialStore();
  return state.issuedCredentialSecrets[instanceId];
}

function storeCredentialSecrets(
  instanceId: string,
  secrets: {
    ingestionTokenHash: string;
    signingSecret: string;
    ingestionTokenPlaintext?: string;
    signingSecretPlaintext?: string;
  }
) {
  ensureCredentialStore();
  state.issuedCredentialSecrets[instanceId] = {
    ingestionTokenHash: secrets.ingestionTokenHash,
    signingSecret: normalizeIngestionToken(secrets.signingSecret),
    ...(secrets.ingestionTokenPlaintext
      ? { ingestionTokenHint: tokenSafeFingerprint(secrets.ingestionTokenPlaintext) }
      : {}),
    ...(secrets.signingSecretPlaintext
      ? { signingSecretHint: tokenSafeFingerprint(secrets.signingSecretPlaintext) }
      : {})
  };
}

function terminalForInstance(instance: EaInstance) {
  return getTerminals().find((terminal) => terminal.id === instance.terminalId || terminal.terminalUuid === instance.terminalId);
}

function dedupeEaInstancesForAccount(accountLogin: string, keepInstanceId: string) {
  const normalizedAccount = normalizeAccountLogin(accountLogin);
  const duplicates = state.instances.filter(
    (instance) => instance.id !== keepInstanceId && normalizeAccountLogin(instance.accountLogin) === normalizedAccount
  );
  if (!duplicates.length) return;

  const keepSecrets = credentialSecrets(keepInstanceId);
  for (const duplicate of duplicates) {
    const duplicateSecrets = credentialSecrets(duplicate.id);
    if (!keepSecrets && duplicateSecrets) {
      storeCredentialSecrets(keepInstanceId, duplicateSecrets);
    }
    delete state.issuedCredentialSecrets[duplicate.id];
    state.sessions = state.sessions.filter((session) => session.eaInstanceId !== duplicate.id);
  }
  state.instances = state.instances.filter((instance) => !duplicates.some((duplicate) => duplicate.id === instance.id));
}

function consolidateEaInstanceCredentials(instance: EaInstance) {
  dedupeEaInstancesForAccount(instance.accountLogin, instance.id);

  const orphanKeys = Object.keys(state.issuedCredentialSecrets).filter((key) => key !== instance.id);
  for (const key of orphanKeys) {
    const bound = state.instances.find((item) => item.id === key);
    if (bound && normalizeAccountLogin(bound.accountLogin) === normalizeAccountLogin(instance.accountLogin)) {
      const orphanSecrets = credentialSecrets(key);
      if (orphanSecrets && !credentialSecrets(instance.id)) {
        storeCredentialSecrets(instance.id, orphanSecrets);
      }
      delete state.issuedCredentialSecrets[key];
    }
  }
}

function resolveCanonicalEaInstance(input: { instanceId?: string; accountLogin?: string; terminalId?: string }) {
  let candidate: EaInstance | undefined;

  if (input.instanceId) {
    candidate = state.instances.find((instance) => instance.id === input.instanceId);
  }

  if (!candidate && input.terminalId) {
    const terminalKey = normalizeBindingKey(input.terminalId);
    candidate = state.instances.find((instance) => {
      const terminal = terminalForInstance(instance);
      return (
        normalizeBindingKey(instance.terminalId) === terminalKey ||
        normalizeBindingKey(instance.id) === terminalKey ||
        normalizeBindingKey(instance.id).replace(/^ea-/, "") === terminalKey.replace(/^ea-/, "") ||
        (terminal ? normalizeBindingKey(terminal.terminalUuid) === terminalKey || normalizeBindingKey(terminal.id) === terminalKey : false)
      );
    });
  }

  if (!candidate && input.accountLogin) {
    const accountKey = normalizeAccountLogin(input.accountLogin);
    const matches = state.instances.filter((instance) => normalizeAccountLogin(instance.accountLogin) === accountKey);
    if (matches.length === 1) {
      candidate = matches[0];
    } else if (matches.length > 1) {
      candidate = [...matches].sort(
        (left, right) => new Date(right.tokenCreatedAt).getTime() - new Date(left.tokenCreatedAt).getTime()
      )[0];
      dedupeEaInstancesForAccount(accountKey, candidate.id);
    }
  }

  if (candidate) {
    consolidateEaInstanceCredentials(candidate);
  }

  return candidate;
}

function recordIngestionAuthFailure(instance: EaInstance | undefined, reason: string) {
  if (!instance) return;
  instance.failedAuthenticationAttempts += 1;
  instance.lastError = reason;
  instance.heartbeatStatus = "Offline";
}

function buildIngestionAuthDiagnostics(input: {
  endpointName: string;
  token: string;
  tokenSource: string | null;
  instance?: EaInstance;
  expectedHash?: string;
  expectedHint?: EaIngestionTokenFingerprint | null;
}): EaIngestionAuthDiagnostics {
  return {
    endpoint: input.endpointName,
    matchedEaInstanceId: input.instance?.id ?? null,
    accountNumber: input.instance?.accountLogin ?? null,
    broker: input.instance?.brokerName ?? null,
    received: tokenSafeFingerprint(input.token),
    expected: input.expectedHint ?? (input.expectedHash ? fingerprintFromHash(input.expectedHash) : null),
    tokenSource: input.tokenSource
  };
}

function rejectIngestionAuth(
  code: EaIngestionAuthErrorCode,
  message: string,
  diagnostics: EaIngestionAuthDiagnostics,
  instance?: EaInstance
) {
  recordIngestionAuthFailure(instance, message);
  logEaIngestionAuthDiagnostics({ ...diagnostics, code, outcome: "rejected" });
  throw new EaIngestionAuthError(code, message, diagnostics);
}

export type AuthorizeEaIngestionInput = {
  request: Request;
  body?: Record<string, unknown>;
  endpointName: string;
  instanceId?: string;
  accountLogin?: string;
  brokerServer?: string;
  terminalId?: string;
};

export function authorizeEaIngestion(input: AuthorizeEaIngestionInput | Request, legacyInstanceId?: string) {
  const normalizedInput: AuthorizeEaIngestionInput = input instanceof Request
    ? { request: input, endpointName: "ingest/legacy", instanceId: legacyInstanceId }
    : input;

  if (normalizedInput.instanceId) {
    ensureLocalDevCredentialAlignment(normalizedInput.instanceId);
  }

  const { token, source } = extractIngestionToken(normalizedInput.request, normalizedInput.body);
  const instance = resolveCanonicalEaInstance({
    instanceId: normalizedInput.instanceId,
    accountLogin: normalizedInput.accountLogin,
    terminalId: normalizedInput.terminalId
  });

  const issuedPreview = instance ? credentialSecrets(instance.id) : undefined;
  const diagnostics = buildIngestionAuthDiagnostics({
    endpointName: normalizedInput.endpointName,
    token,
    tokenSource: source,
    instance,
    expectedHash: issuedPreview?.ingestionTokenHash,
    expectedHint: issuedPreview?.ingestionTokenHint ?? null
  });

  if (!instance) {
    rejectIngestionAuth(
      "ea_instance_not_found",
      "EA bridge instance not found for the supplied instance, terminal, or account binding.",
      diagnostics
    );
  }

  const boundInstance = instance!;

  if (normalizedInput.accountLogin && normalizeAccountLogin(normalizedInput.accountLogin) !== normalizeAccountLogin(boundInstance.accountLogin)) {
    rejectIngestionAuth(
      "account_mismatch",
      "Heartbeat account number does not match the bound EA instance account.",
      diagnostics,
      boundInstance
    );
  }

  if (normalizedInput.terminalId) {
    const terminal = terminalForInstance(boundInstance);
    const terminalKey = normalizeBindingKey(normalizedInput.terminalId);
    const matchesTerminal = (
      normalizeBindingKey(boundInstance.terminalId) === terminalKey ||
      normalizeBindingKey(boundInstance.id) === terminalKey ||
      normalizeBindingKey(boundInstance.id).replace(/^ea-/, "") === terminalKey.replace(/^ea-/, "") ||
      (terminal ? normalizeBindingKey(terminal.terminalUuid) === terminalKey || normalizeBindingKey(terminal.id) === terminalKey : false)
    );
    if (!matchesTerminal) {
      rejectIngestionAuth(
        "terminal_mismatch",
        "Terminal identity does not match the bound EA instance.",
        diagnostics,
        boundInstance
      );
    }
  }

  if (normalizedInput.brokerServer) {
    const terminal = terminalForInstance(boundInstance);
    const expectedServer = normalizeBindingKey(terminal?.serverName ?? boundInstance.brokerName);
    const receivedServer = normalizeBindingKey(normalizedInput.brokerServer);
    if (expectedServer && receivedServer && expectedServer !== receivedServer) {
      rejectIngestionAuth(
        "terminal_mismatch",
        "Broker server does not match the bound EA instance terminal registration.",
        diagnostics,
        boundInstance
      );
    }
  }

  if (boundInstance.tokenStatus === "Revoked" || boundInstance.tokenStatus === "Compromised") {
    rejectIngestionAuth(
      "pairing_revoked",
      "EA pairing credentials were revoked. Reissue EA Pairing before attempting ingestion again.",
      diagnostics,
      boundInstance
    );
  }

  if (!token) {
    rejectIngestionAuth(
      "token_missing",
      "EA ingestion token is missing. Supply x-ingestion-token, Authorization Bearer, or body.ingestionToken.",
      diagnostics,
      boundInstance
    );
  }

  const envToken = localDevIngestionToken();
  const envMatch = Boolean(envToken && normalizeIngestionToken(token) === envToken);
  const issued = credentialSecrets(boundInstance.id);
  const receivedHash = hashIngestionToken(token);
  const issuedMatch = Boolean(issued?.ingestionTokenHash && receivedHash === issued.ingestionTokenHash);

  if (!envMatch && !issuedMatch) {
    const receivedHint = tokenSafeFingerprint(token);
    const expectedHint = issued?.ingestionTokenHint ?? fingerprintFromHash(issued?.ingestionTokenHash ?? "");
    rejectIngestionAuth(
      "token_mismatch",
      `EA token ${receivedHint.prefix}…${receivedHint.suffix} (len ${receivedHint.length}) does not match active pairing ${expectedHint.prefix}…${expectedHint.suffix} (len ${expectedHint.length}). Reissue EA Pairing, click Test Pairing, then paste that receipt into NexusBridgeEA inputs.`,
      diagnostics,
      boundInstance
    );
  }

  logEaIngestionAuthDiagnostics({
    ...diagnostics,
    outcome: "accepted"
  });

  return boundInstance;
}

function authorizeIngestFromEnvelope(request: Request, envelope: SignedBridgeEnvelope, endpointName: string) {
  const hints = readIngestBindingHints(envelope);
  return authorizeEaIngestion({
    request,
    body: envelope,
    endpointName,
    instanceId: envelope.instanceId ?? hints.instanceId,
    accountLogin: hints.accountLogin,
    brokerServer: hints.brokerServer,
    terminalId: hints.terminalId
  });
}

export function resetEaBridgeState(override?: ReturnType<typeof createEaBridgeSeed>) {
  const next = override ?? createEaBridgeSeed();
  for (const key of Object.keys(next) as (keyof typeof next)[]) {
    (state as Record<string, unknown>)[key as string] = next[key];
  }
  state.audits = [];
  state.lastSyncAt = new Date().toISOString();
  state.usedNonces = new Set(next.messages.map((message) => message.nonce));
  state.issuedCredentialSecrets = { ...next.issuedCredentialSecrets };
}

export function eaBridgeRole(request?: Request): Mt5Role {
  return resolveMt5Role(request);
}

const permissions: Record<string, Mt5Role[]> = {
  sync: ["Super Admin", "Infrastructure Admin"],
  diagnostics: ["Super Admin", "Infrastructure Admin"],
  restart: ["Super Admin", "Infrastructure Admin"],
  rotateToken: ["Super Admin", "Infrastructure Admin"],
  reissuePairing: ["Super Admin", "Infrastructure Admin"],
  tradeControl: ["Super Admin", "Trading Admin"],
  rebindTerminal: ["Super Admin", "Infrastructure Admin"],
  autoRemediate: ["Super Admin", "Infrastructure Admin"],
  emergencyDisable: ["Super Admin"],
  provision: ["Super Admin", "Infrastructure Admin"]
};

function authorize(role: Mt5Role, action: keyof typeof permissions) {
  if (!permissions[action].includes(role)) throw new Error(`Role "${role}" is not authorized to perform EA bridge ${action}.`);
}

function requireConfirmation(confirmed?: boolean) {
  if (!confirmed) throw new Error("Confirmation is required for this restricted EA bridge action.");
}

function audit(role: Mt5Role, action: string, entityId: string, oldValue: unknown, newValue: unknown, request?: Request) {
  state.audits.unshift({
    id: `ea-audit-${Date.now()}-${state.audits.length}`, userId: request?.headers.get("x-user-id") ?? role.toLowerCase().replace(/\s+/g, "-"),
    action, module: "EA Bridge", entityId, oldValue, newValue, ipAddress: request?.headers.get("x-forwarded-for") ?? "system",
    userAgent: request?.headers.get("user-agent") ?? "autonomous-ea-bridge", timestamp: new Date().toISOString()
  });
}

function instanceById(id: string) {
  const instance = state.instances.find((item) => item.id === id);
  if (!instance) throw new Error("EA bridge instance not found.");
  return instance;
}

function addLog(instance: EaInstance, logType: BridgeLog["logType"], severity: BridgeLog["severity"], message: string, details: string) {
  state.logs.unshift({
    id: `log-${Date.now()}-${state.logs.length}`, eaInstanceId: instance.id, eaInstanceName: instance.eaName, terminalName: instance.terminalName,
    accountLogin: instance.accountLogin, logType, severity, message, technicalDetails: details, resolved: false, createdAt: new Date().toISOString()
  });
}

function refreshInstance(instance: EaInstance) {
  const delay = Math.max(0, Math.round((Date.now() - new Date(instance.lastHeartbeatAt).getTime()) / 1000));
  instance.heartbeatStatus = delay <= 30 ? "Healthy" : delay <= 60 ? "Watch" : delay <= 120 ? "Degraded" : delay <= 300 ? "Critical" : "Offline";
  const risk = classifyTokenRisk(instance);
  if (risk === "Critical") instance.riskLevel = "Critical";
  return instance;
}

function redactInstance(instance: EaInstance): EaInstance {
  return { ...instance, bridgeTokenHash: "[redacted]" };
}

export function bridgeInstances() { return state.instances.map(refreshInstance); }
export function bridgeInstance(id: string) { return refreshInstance(instanceById(id)); }
export function publicBridgeInstances() { return bridgeInstances().map(redactInstance); }

export function removeBridgeInstancesByAccountLogin(accountLogin: string) {
  const normalized = accountLogin.trim();
  if (!normalized) return 0;
  const removedIds = new Set(
    state.instances.filter((instance) => instance.accountLogin === normalized).map((instance) => instance.id)
  );
  if (!removedIds.size) return 0;
  state.instances = state.instances.filter((instance) => !removedIds.has(instance.id));
  state.sessions = state.sessions.filter((session) => !removedIds.has(session.eaInstanceId));
  for (const instanceId of removedIds) {
    delete state.issuedCredentialSecrets[instanceId];
  }
  return removedIds.size;
}
export function publicBridgeInstance(id: string) { return redactInstance(bridgeInstance(id)); }
export function bridgeSessions() { return state.sessions; }
export function bridgeMessages() { return state.messages; }
export function bridgeCommands() { return state.commands; }
export function bridgeLogs() { return state.logs; }
export function bridgeDiagnostics() { return state.diagnostics; }
export function bridgeAudits() { return state.audits; }

function signingSecretFor(instanceId: string) {
  ensureLocalDevCredentialAlignment(instanceId);
  const instanceKey = `MT5_EA_SIGNING_SECRET_${instanceId.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`;
  if (isLocalDevOperatorMode()) {
    const envSecret = localDevSigningSecret(instanceId);
    if (envSecret) return envSecret;
  }
  const secret = credentialSecrets(instanceId)?.signingSecret ?? normalizeIngestionToken(process.env[instanceKey] ?? process.env.MT5_EA_SIGNING_SECRET ?? "");
  if (!secret) throw new Error("EA ingestion not authorized. Configure an MT5 signing secret.");
  return secret;
}

function signingInput(envelope: Omit<SignedBridgeEnvelope, "signature">) {
  return [envelope.instanceId, envelope.messageType, envelope.timestamp, envelope.nonce, envelope.payloadJson].join("\n");
}

export function signBridgeEnvelope(envelope: Omit<SignedBridgeEnvelope, "signature">, secret: string) {
  return createHmac("sha256", secret).update(signingInput(envelope)).digest("hex");
}

function parsePayload<T>(envelope: SignedBridgeEnvelope) {
  try {
    return JSON.parse(envelope.payloadJson) as T;
  } catch {
    throw new Error("Schema validation error: payloadJson must contain valid JSON.");
  }
}

function verifySignedEnvelope(envelope: SignedBridgeEnvelope, expectedType: TerminalMessageType) {
  if (envelope.messageType !== expectedType) throw new Error("Schema validation error: terminal message type does not match endpoint.");
  const validation = validateBridgePayload({
    schemaVersion: "v1.0",
    nonce: envelope.nonce,
    timestamp: envelope.timestamp,
    signed: Boolean(envelope.signature),
    usedNonces: state.usedNonces
  });
  if (!validation.valid) throw new Error(validation.reason);
  const unsigned = {
    instanceId: envelope.instanceId,
    messageType: envelope.messageType,
    timestamp: envelope.timestamp,
    nonce: envelope.nonce,
    payloadJson: envelope.payloadJson
  };
  const expected = Buffer.from(signBridgeEnvelope(unsigned, signingSecretFor(envelope.instanceId)), "hex");
  const supplied = Buffer.from(envelope.signature, "hex");
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) {
    const stored = credentialSecrets(envelope.instanceId);
    const secretHint = stored?.signingSecretHint;
    const hintText = secretHint
      ? ` Active pairing SigningSecret fingerprint: ${secretHint.prefix}…${secretHint.suffix} (len ${secretHint.length}).`
      : "";
    throw new EaIngestionAuthError(
      "signing_secret_mismatch",
      `Signed payload validation failed. The SigningSecret in NexusBridgeEA does not match the active pairing receipt.${hintText} Paste both IngestionToken and SigningSecret from the same EA Bridge receipt.`,
      buildIngestionAuthDiagnostics({
        endpointName: ingestEndpointName(expectedType),
        token: "",
        tokenSource: null,
        instance: resolveCanonicalEaInstance({ instanceId: envelope.instanceId }),
        expectedHint: secretHint ?? null
      })
    );
  }
  return resolveCanonicalEaInstance({ instanceId: envelope.instanceId }) ?? instanceById(envelope.instanceId);
}

function recordSignedMessage(envelope: SignedBridgeEnvelope, instance: EaInstance, destination: string) {
  state.usedNonces.add(envelope.nonce);
  const createdAt = new Date().toISOString();
  let session = state.sessions.find((item) => item.eaInstanceId === instance.id);
  if (!session) {
    session = {
      id: `sess-${instance.id}`, sessionUuid: `https-session-${instance.id}`, eaInstanceId: instance.id, eaInstanceName: instance.eaName,
      terminalName: instance.terminalName, brokerName: instance.brokerName, accountLogin: instance.accountLogin, ipAddress: instance.currentIpAddress,
      protocol: "HTTPS Signed Push", authStatus: "Authenticated", connectionStartedAt: createdAt, lastMessageAt: createdAt, sessionDurationSeconds: 0,
      messageRatePerMinute: 1, latencyMs: 0, status: "Healthy"
    };
    state.sessions.push(session);
    instance.activeSessionCount = 1;
  }
  const message: BridgeMessage = {
    id: `live-msg-${Date.now()}-${state.messages.length}`,
    messageUuid: `live-${envelope.nonce}`,
    eaInstanceId: instance.id,
    sessionId: session?.id ?? "session-unbound",
    messageType: envelope.messageType,
    source: instance.eaName,
    destination,
    payloadHash: `sha256:${createHash("sha256").update(envelope.payloadJson).digest("hex")}`,
    schemaVersion: "v1.0",
    nonce: envelope.nonce,
    signed: true,
    status: "Delivered",
    retryCount: 0,
    processingTimeMs: Math.max(0, Date.now() - new Date(envelope.timestamp).getTime()),
    createdAt,
    deliveredAt: createdAt
  };
  state.messages.unshift(message);
  instance.messageCount += 1;
  instance.updatedAt = createdAt;
  if (session) {
    session.lastMessageAt = createdAt;
    session.latencyMs = message.processingTimeMs;
    session.status = "Healthy";
    session.authStatus = "Authenticated";
  }
  return message;
}

export function ingestSignedBridgeEvent(
  envelope: SignedBridgeEnvelope,
  expectedType: Exclude<TerminalMessageType, "Trade Execution Result" | "Command Poll">,
  request: Request,
  ingestBody?: Record<string, unknown>
) {
  ensureUsedNonces();
  authorizeIngestFromEnvelope(request, envelope, ingestEndpointName(expectedType));
  const instance = verifySignedEnvelope(envelope, expectedType);
  let accountSync: ReturnType<typeof ingestTerminalAccountSnapshot> | undefined;
  if (expectedType === "Heartbeat") {
    const payload = parsePayload<TerminalHeartbeatPayload>(envelope);
    if (payload.accountLogin !== instance.accountLogin) throw new Error("Schema validation error: heartbeat account is not bound to this EA instance.");
    instance.terminalName = payload.terminalName || instance.terminalName;
    instance.lastHeartbeatAt = envelope.timestamp;
    instance.averageLatencyMs = payload.latencyMs;
    instance.connectionStatus = payload.brokerConnected ? "Healthy" : "Degraded";
    instance.heartbeatStatus = "Healthy";
    instance.riskLevel = payload.brokerConnected ? "Healthy" : "Degraded";
    instance.lastError = payload.brokerConnected ? null : "Verified heartbeat received without active broker connection.";
    const remoteAddress = request.headers.get("x-forwarded-for");
    if (remoteAddress) {
      if (instance.knownIpAddress === "Pending verification") instance.knownIpAddress = remoteAddress;
      instance.currentIpAddress = remoteAddress;
    }
    if (!payload.tradingEnabled) instance.tradingChannelEnabled = false;
    activateRegisteredTerminalFromHeartbeat(instance.terminalId, payload, envelope.timestamp);
    recordVerifiedTerminalHeartbeat(instance.terminalId, payload, envelope.timestamp);
  } else if (expectedType === "Account Snapshot") {
    const payload = parsePayload<TerminalAccountSnapshotPayload>(envelope);
    if (payload.accountLogin !== instance.accountLogin) throw new Error("Schema validation error: snapshot account is not bound to this EA instance.");
    accountSync = ingestTerminalAccountSnapshot(payload);
  } else if (expectedType === "Position Update") {
    const payload = parsePayload<TerminalPositionUpdatePayload>(envelope);
    if (payload.accountLogin !== instance.accountLogin) throw new Error("Schema validation error: position update account is not bound to this EA instance.");
    accountSync = ingestTerminalPositionUpdates(payload);
  } else if (expectedType === "Pending Order Update") {
    const payload = parsePayload<TerminalPendingOrderUpdatePayload>(envelope);
    if (payload.accountLogin !== instance.accountLogin) throw new Error("Schema validation error: pending order update account is not bound to this EA instance.");
    accountSync = ingestTerminalPendingOrderUpdates(payload);
  } else {
    parsePayload<unknown>(envelope);
  }
  const message = recordSignedMessage(envelope, instance, expectedType === "Account Snapshot" ? "Account Sync Service" : "EA Bridge Monitor");
  return { accepted: true, message, accountSync };
}

export function pendingTradeCommands(instanceId: string, envelope: SignedBridgeEnvelope, request: Request, ingestBody?: Record<string, unknown>) {
  const canonical = resolveCanonicalEaInstance({ instanceId: instanceId ?? envelope.instanceId }) ?? instanceById(instanceId);
  const envelopeWithInstance = { ...envelope, instanceId: canonical.id, ...(ingestBody ?? {}) };
  authorizeIngestFromEnvelope(request, envelopeWithInstance, ingestEndpointName("Command Poll"));
  if (envelope.instanceId && envelope.instanceId !== canonical.id) {
    throw new Error("Command poll instance does not match the requested channel.");
  }
  verifySignedEnvelope({ ...envelope, instanceId: canonical.id }, "Command Poll");
  recordSignedMessage({ ...envelope, instanceId: canonical.id }, canonical, "Trade Command Router");
  const channel = canDeliverTradeCommand(canonical, classifyTokenRisk(canonical));
  if (!channel.allowed) return { commands: [] as TradeCommand[], blockedReason: channel.reason };
  const commands = state.commands.filter((command) =>
    command.eaInstanceId === canonical.id &&
    command.riskApprovalStatus === "Approved" &&
    command.deliveryStatus === "Pending" &&
    command.executionStatus === "Pending"
  );
  return { commands };
}

export function acknowledgeTradeCommand(instanceId: string, envelope: SignedBridgeEnvelope, request: Request, ingestBody?: Record<string, unknown>) {
  const canonical = resolveCanonicalEaInstance({ instanceId: instanceId ?? envelope.instanceId }) ?? instanceById(instanceId);
  const envelopeWithInstance = { ...envelope, instanceId: canonical.id, ...(ingestBody ?? {}) };
  authorizeIngestFromEnvelope(request, envelopeWithInstance, ingestEndpointName("Trade Execution Result"));
  const instance = verifySignedEnvelope({ ...envelope, instanceId: canonical.id }, "Trade Execution Result");
  if (instance.id !== canonical.id) throw new Error("Execution feedback instance does not match the command channel.");
  const payload = parsePayload<TerminalExecutionFeedbackPayload>(envelope);
  const command = state.commands.find((item) => item.commandUuid === payload.commandUuid && item.eaInstanceId === canonical.id);
  if (!command) throw new Error("Trade command acknowledgement does not match an issued Nexus command.");
  command.deliveryStatus = "Delivered";
  command.responseTimeMs = payload.responseTimeMs;
  if (payload.status === "Executed") {
    command.executionStatus = "Executed";
    command.executedAt = envelope.timestamp;
    command.rejectionReason = undefined;
  } else if (payload.status === "Rejected") {
    command.executionStatus = "Rejected";
    command.rejectionReason = payload.rejectionReason ?? "MT5 rejected the trade command.";
    addLog(instance, "Broker", "Critical", "MT5 command execution rejected.", command.rejectionReason);
  }
  const message = recordSignedMessage(envelope, instance, "Trade Command Router");
  audit("Infrastructure Admin", "EA execution feedback received", command.id, null, { status: payload.status, responseTimeMs: payload.responseTimeMs }, request);
  return { accepted: true, command, message };
}

export function provisionEaBridgeInstance(input: {
  terminal: Terminal;
  accountId: string;
  eaName: string;
  symbolScope?: string[];
}, role: Mt5Role, confirmed: boolean, request?: Request) {
  authorize(role, "provision");
  requireConfirmation(confirmed);
  if (state.instances.some((instance) => instance.terminalId === input.terminal.id || instance.accountLogin === input.terminal.accountLogin)) {
    throw new Error("EA bridge instance is already bound to this terminal or account.");
  }
  const now = new Date().toISOString();
  const id = `ea-${input.terminal.terminalUuid.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  const envIngestionToken = isLocalDevOperatorMode() ? localDevIngestionToken() : undefined;
  const envSigningSecret = isLocalDevOperatorMode() ? localDevSigningSecret(id) : undefined;
  const ingestionToken = envIngestionToken ?? randomBytes(32).toString("base64url");
  const signingSecret = envSigningSecret ?? randomBytes(32).toString("base64url");
  const instance: EaInstance = {
    id, eaInstanceUuid: `${id}-uuid`, eaName: input.eaName, terminalId: input.terminal.id, terminalName: input.terminal.terminalName,
    brokerId: input.terminal.brokerId, brokerName: input.terminal.brokerName, accountId: input.accountId, accountLogin: input.terminal.accountLogin,
    symbolScope: input.symbolScope ?? [], eaVersion: "Provisioned", buildNumber: 0,
    bridgeTokenHash: `sha256:${hashIngestionToken(ingestionToken)}`, tokenStatus: "Valid", tokenCreatedAt: now,
    failedAuthenticationAttempts: 0, knownIpAddress: request?.headers.get("x-forwarded-for") ?? "Pending verification", currentIpAddress: request?.headers.get("x-forwarded-for") ?? "Pending verification",
    knownDeviceFingerprint: true, activeSessionCount: 0, permissionMismatch: false, connectionStatus: "Syncing", heartbeatStatus: "Syncing",
    lastHeartbeatAt: now, messageCount: 0, failedMessageCount: 0, averageLatencyMs: 0, tradingChannelEnabled: false, riskLevel: "Syncing",
    lastError: "Awaiting first signed terminal heartbeat.", updatedAt: now
  };
  storeCredentialSecrets(id, {
    ingestionTokenHash: hashIngestionToken(ingestionToken),
    signingSecret,
    ingestionTokenPlaintext: ingestionToken,
    signingSecretPlaintext: signingSecret
  });
  state.instances.push(instance);
  addLog(instance, "Connection", "Info", "EA instance provisioned.", "Awaiting first signed heartbeat; command channel disabled.");
  audit(role, "EA bridge instance provisioned", id, null, { terminalId: instance.terminalId, accountId: instance.accountId, tradingChannelEnabled: false }, request);
  return { instance: redactInstance(instance), ingestionToken, signingSecret };
}

export function syncEaInstances(role: Mt5Role, confirmed: boolean, request?: Request) {
  authorize(role, "sync");
  requireConfirmation(confirmed);
  state.lastSyncAt = new Date().toISOString();
  audit(role, "EA instances synchronized", "all-instances", null, { count: state.instances.length, at: state.lastSyncAt }, request);
  return publicBridgeInstances();
}

export function runBridgeDiagnostics(id: string | null, role: Mt5Role, confirmed: boolean, request?: Request) {
  authorize(role, "diagnostics");
  requireConfirmation(confirmed);
  const diagnostics = id ? state.diagnostics.filter((item) => item.eaInstanceId === id) : state.diagnostics;
  audit(role, "Bridge diagnostics run", id ?? "all-instances", null, { issues: diagnostics.length }, request);
  return { completedAt: new Date().toISOString(), diagnostics };
}

export function restartBridgeSession(id: string, role: Mt5Role, confirmed: boolean, request?: Request) {
  authorize(role, "restart");
  requireConfirmation(confirmed);
  const instance = bridgeInstance(id);
  const old = { connectionStatus: instance.connectionStatus, tradingChannelEnabled: instance.tradingChannelEnabled };
  instance.tradingChannelEnabled = false;
  instance.connectionStatus = "Syncing";
  instance.heartbeatStatus = "Syncing";
  instance.lastHeartbeatAt = new Date().toISOString();
  const session = state.sessions.find((item) => item.eaInstanceId === id);
  if (session) {
    session.status = "Syncing";
    session.lastMessageAt = new Date().toISOString();
  }
  addLog(instance, "Connection", "Warning", "Bridge session restart initiated.", "Trading channel disabled pending fresh authentication.");
  audit(role, "Bridge session restarted", id, old, { connectionStatus: instance.connectionStatus, tradingChannelEnabled: false }, request);
  return { instance: redactInstance(instance), workflow: ["Disable command channel", "Verify instance identity", "Validate token hash", "Open new session", "Replay safe undelivered messages", "Restore trading after risk approval"] };
}

export function rotateBridgeToken(id: string, role: Mt5Role, confirmed: boolean, request?: Request) {
  authorize(role, "rotateToken");
  requireConfirmation(confirmed);
  const instance = bridgeInstance(id);
  const old = { tokenStatus: instance.tokenStatus };
  instance.bridgeTokenHash = `sha256:rotated-${Date.now().toString(36)}...stored-hash-only`;
  instance.tokenStatus = "Rotated";
  instance.tokenCreatedAt = new Date().toISOString();
  instance.failedAuthenticationAttempts = 0;
  addLog(instance, "Token", "Info", "Bridge token rotated.", "Plaintext token was not retained; only replacement hash stored.");
  audit(role, "Bridge token rotated", id, old, { tokenStatus: instance.tokenStatus, storedHashUpdated: true }, request);
  return redactInstance(instance);
}

export function reissueEaPairingCredentials(id: string, role: Mt5Role, confirmed: boolean, request?: Request): EaPairingReceipt {
  authorize(role, "reissuePairing");
  requireConfirmation(confirmed);
  const instance = resolveCanonicalEaInstance({ instanceId: id }) ?? instanceById(id);
  consolidateEaInstanceCredentials(instance);
  const ingestionToken = randomBytes(32).toString("base64url");
  const signingSecret = randomBytes(32).toString("base64url");
  const now = new Date().toISOString();
  instance.bridgeTokenHash = `sha256:${hashIngestionToken(ingestionToken)}`;
  instance.tokenStatus = "Valid";
  instance.tokenCreatedAt = now;
  instance.failedAuthenticationAttempts = 0;
  instance.lastError = "Awaiting first signed terminal heartbeat.";
  storeCredentialSecrets(instance.id, {
    ingestionTokenHash: hashIngestionToken(ingestionToken),
    signingSecret,
    ingestionTokenPlaintext: ingestionToken,
    signingSecretPlaintext: signingSecret
  });
  addLog(
    instance,
    "Token",
    "Info",
    "EA pairing credentials reissued.",
    "Previous ingestion token invalidated. Paste the new receipt into NexusBridgeEA inputs."
  );
  audit(role, "EA pairing credentials reissued", instance.id, null, { tokenStatus: instance.tokenStatus }, request);
  return {
    eaInstanceId: instance.id,
    terminalName: instance.terminalName,
    accountLogin: instance.accountLogin,
    ingestionToken,
    signingSecret,
    nexusBaseUrl: eaBridgePublicBaseUrl(request),
    state: "Reissued Pairing Credentials"
  } satisfies EaPairingReceipt;
}

export function testEaPairingCredentials(
  id: string,
  ingestionToken: string,
  signingSecret: string,
  role: Mt5Role,
  confirmed: boolean,
  request?: Request
) {
  authorize(role, "reissuePairing");
  requireConfirmation(confirmed);
  const instance = resolveCanonicalEaInstance({ instanceId: id }) ?? instanceById(id);
  const normalizedToken = normalizeIngestionToken(ingestionToken);
  const normalizedSecret = normalizeIngestionToken(signingSecret);
  if (!normalizedToken || !normalizedSecret) {
    throw new EaIngestionAuthError(
      "token_missing",
      "Both ingestionToken and signingSecret are required to test pairing.",
      buildIngestionAuthDiagnostics({
        endpointName: "test-pairing",
        token: normalizedToken,
        tokenSource: "body.ingestionToken",
        instance,
        expectedHash: credentialSecrets(instance.id)?.ingestionTokenHash
      })
    );
  }

  const testRequest = new Request(request?.url ?? "http://127.0.0.1:3000/api/mt5/ea-bridge/instances/test-pairing", {
    method: "POST",
    headers: {
      authorization: `Bearer ${normalizedToken}`,
      "x-ingestion-token": normalizedToken
    }
  });
  authorizeEaIngestion({
    request: testRequest,
    body: { instanceId: instance.id, ingestionToken: normalizedToken, accountLogin: instance.accountLogin },
    endpointName: "test-pairing",
    instanceId: instance.id,
    accountLogin: instance.accountLogin
  });

  const stored = credentialSecrets(instance.id);
  const storedSecret = stored?.signingSecret;
  if (!storedSecret || normalizeIngestionToken(storedSecret) !== normalizedSecret) {
    throw new EaIngestionAuthError(
      "signing_secret_mismatch",
      "SigningSecret does not match the active pairing credentials for this EA instance.",
      buildIngestionAuthDiagnostics({
        endpointName: "test-pairing",
        token: normalizedToken,
        tokenSource: "body.ingestionToken",
        instance,
        expectedHash: stored?.ingestionTokenHash,
        expectedHint: stored?.ingestionTokenHint ?? null
      })
    );
  }

  const payload: TerminalHeartbeatPayload = {
    terminalName: instance.terminalName,
    accountLogin: instance.accountLogin,
    brokerConnected: true,
    marketDataActive: true,
    tradingEnabled: false,
    latencyMs: 1
  };
  const unsigned = {
    instanceId: instance.id,
    messageType: "Heartbeat" as const,
    timestamp: new Date().toISOString(),
    nonce: `test-pairing-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    payloadJson: JSON.stringify(payload)
  };
  const envelope: SignedBridgeEnvelope = {
    ...unsigned,
    signature: signBridgeEnvelope(unsigned, normalizedSecret)
  };

  const result = ingestSignedBridgeEvent(envelope, "Heartbeat", testRequest, {
    instanceId: instance.id,
    ingestionToken: normalizedToken,
    accountLogin: instance.accountLogin
  });

  const submittedHint = tokenSafeFingerprint(normalizedToken);

  return {
    accepted: true,
    code: "accepted" as const,
    eaInstanceId: instance.id,
    accountLogin: instance.accountLogin,
    broker: instance.brokerName,
    diagnostics: buildIngestionAuthDiagnostics({
      endpointName: "ingest/heartbeat",
      token: normalizedToken,
      tokenSource: "body.ingestionToken",
      instance,
      expectedHash: stored?.ingestionTokenHash,
      expectedHint: stored?.ingestionTokenHint ?? submittedHint
    }),
    heartbeat: result
  };
}

export function setBridgeTrading(id: string, enabled: boolean, role: Mt5Role, confirmed: boolean, request?: Request) {
  authorize(role, "tradeControl");
  requireConfirmation(confirmed);
  const instance = bridgeInstance(id);
  if (enabled) {
    const validation = canDeliverTradeCommand(instance, classifyTokenRisk(instance));
    if (!validation.allowed && validation.reason !== "EA trading channel is disabled.") throw new Error(`Trading channel enable blocked: ${validation.reason}`);
    if (classifyTokenRisk(instance) === "High" || classifyTokenRisk(instance) === "Critical") throw new Error("Trading channel enable blocked: token risk is unacceptable.");
  }
  const old = instance.tradingChannelEnabled;
  instance.tradingChannelEnabled = enabled;
  addLog(instance, "Risk", enabled ? "Info" : "Warning", `EA trading channel ${enabled ? "enabled" : "disabled"}.`, "Command delivery policy updated and audit captured.");
  audit(role, enabled ? "EA trading channel enabled" : "EA trading channel disabled", id, old, enabled, request);
  return redactInstance(instance);
}

export function rebindTerminal(id: string, terminalName: string, role: Mt5Role, confirmed: boolean, request?: Request) {
  authorize(role, "rebindTerminal");
  requireConfirmation(confirmed);
  const instance = bridgeInstance(id);
  const old = instance.terminalName;
  instance.terminalName = terminalName || instance.terminalName;
  instance.connectionStatus = "Syncing";
  addLog(instance, "Connection", "Info", "Terminal binding validation requested.", `Previous terminal: ${old}; target: ${instance.terminalName}`);
  audit(role, "EA terminal rebound", id, old, instance.terminalName, request);
  return redactInstance(instance);
}

export function emergencyDisableEaTrading(role: Mt5Role, confirmed: boolean, request?: Request) {
  authorize(role, "emergencyDisable");
  requireConfirmation(confirmed);
  state.instances.forEach((instance) => {
    instance.tradingChannelEnabled = false;
    addLog(instance, "Risk", "Critical", "Emergency command-channel shutdown applied.", "Super Admin override disabled EA command delivery.");
  });
  audit(role, "Emergency disable all EA trading channels", "all-instances", { enabled: true }, { enabled: false }, request);
  return { message: "All EA trading channels are disabled.", affectedInstances: state.instances.length };
}

export function acceptBridgeMessage(message: BridgeMessage) {
  const validation = validateBridgePayload({ schemaVersion: message.schemaVersion, nonce: message.nonce, timestamp: message.createdAt, signed: message.signed, usedNonces: state.usedNonces });
  if (!validation.valid) {
    message.status = "Rejected";
    message.failureReason = validation.reason;
    state.messages.unshift(message);
    addLog(instanceById(message.eaInstanceId), validation.reason.includes("Schema") ? "Schema" : "Payload", "Critical", "EA message rejected.", validation.reason);
    return { accepted: false, reason: validation.reason };
  }
  state.usedNonces.add(message.nonce);
  message.status = "Delivered";
  message.deliveredAt = new Date().toISOString();
  state.messages.unshift(message);
  return { accepted: true, message };
}

export function queueTradeCommand(candidate: TradeCommand, role: Mt5Role, confirmed: boolean, request?: Request) {
  authorize(role, "tradeControl");
  requireConfirmation(confirmed);
  const instance = bridgeInstance(candidate.eaInstanceId);
  if (isDuplicateCommand(candidate, state.commands)) {
    candidate.riskApprovalStatus = "Blocked";
    candidate.deliveryStatus = "Blocked";
    candidate.executionStatus = "Rejected";
    candidate.rejectionReason = "Duplicate trade command blocked inside replay window.";
    state.commands.unshift(candidate);
    addLog(instance, "Duplicate", "Critical", "Duplicate trade command rejected.", candidate.rejectionReason);
    audit(role, "Duplicate EA trade command blocked", candidate.id, null, { reason: candidate.rejectionReason }, request);
    return { accepted: false, reason: candidate.rejectionReason };
  }
  const channel = canDeliverTradeCommand(instance, classifyTokenRisk(instance));
  if (!channel.allowed) {
    candidate.riskApprovalStatus = "Blocked";
    candidate.deliveryStatus = "Blocked";
    candidate.executionStatus = "Rejected";
    candidate.rejectionReason = channel.reason;
    state.commands.unshift(candidate);
    audit(role, "EA trade command blocked", candidate.id, null, { reason: candidate.rejectionReason }, request);
    return { accepted: false, reason: channel.reason };
  }
  candidate.deliveryStatus = "Pending";
  candidate.executionStatus = "Pending";
  candidate.responseTimeMs = 0;
  candidate.executedAt = undefined;
  candidate.rejectionReason = undefined;
  state.commands.unshift(candidate);
  audit(role, "EA trade command queued", candidate.id, null, { eaInstanceId: candidate.eaInstanceId, riskApprovalStatus: candidate.riskApprovalStatus }, request);
  return { accepted: true, command: candidate };
}

export function autoRemediateBridge(diagnosticId: string, role: Mt5Role, confirmed: boolean, request?: Request) {
  authorize(role, "autoRemediate");
  requireConfirmation(confirmed);
  const diagnostic = state.diagnostics.find((item) => item.id === diagnosticId);
  if (!diagnostic) throw new Error("EA bridge diagnostic not found.");
  if (!diagnostic.autoFixEligible) throw new Error("This bridge issue is not eligible for auto-fix.");
  const instance = bridgeInstance(diagnostic.eaInstanceId);
  instance.tradingChannelEnabled = false;
  diagnostic.autoFixStatus = "Running";
  const retrying = state.messages.filter((message) => message.eaInstanceId === instance.id && message.status === "Retrying" && message.messageType !== "Trade Request");
  retrying.forEach((message) => {
    message.status = "Delivered";
    message.retryCount += 1;
    message.deliveredAt = new Date().toISOString();
  });
  audit(role, "EA bridge auto-remediation triggered", diagnosticId, "Available", { status: "Running", safeMessagesReplayed: retrying.length }, request);
  return { diagnostic, safeMessagesReplayed: retrying.length, workflow: ["Verify EA identity", "Validate token status", "Reopen session", "Replay safe messages", "Block duplicate commands", "Await trading approval"] };
}

export function buildEaBridgeResponse(role: Mt5Role = "Infrastructure Admin"): EaBridgeResponse {
  if (isLocalDevOperatorMode()) {
    for (const instance of state.instances) {
      ensureLocalDevCredentialAlignment(instance.id);
    }
  }
  const instances = bridgeInstances();
  const now = new Date().toISOString();
  const deliveredCommands = state.commands.filter((command) => command.deliveryStatus === "Delivered").length;
  const successfulCommands = state.commands.filter((command) => command.executionStatus === "Executed").length;
  const averageLatency = instances.length ? Math.round(instances.reduce((sum, instance) => sum + instance.averageLatencyMs, 0) / instances.length) : 0;
  const healthyHeartbeat = instances.length ? instances.filter((instance) => instance.heartbeatStatus === "Healthy").length / instances.length * 100 : 0;
  const authenticated = state.sessions.length ? state.sessions.filter((session) => session.authStatus === "Authenticated").length / state.sessions.length * 100 : 0;
  const feedback = state.messages.filter((message) => message.messageType === "Trade Execution Result" && message.status === "Delivered").length / Math.max(1, deliveredCommands) * 100;
  const bridgeHealth = calculateBridgeHealth({
    heartbeatPercent: healthyHeartbeat, authenticationPercent: authenticated, messages: state.messages, averageLatencyMs: averageLatency,
    commandSuccessPercent: successfulCommands / Math.max(1, state.commands.length) * 100, feedbackPercent: feedback,
    errorCount: state.logs.filter((log) => !log.resolved && log.severity === "Critical").length
  });
  const delivery = calculateDeliveryReliability(state.messages);
  const deliveredMessages = state.messages.filter((item) => item.deliveredAt);
  const lastSuccessfulMessage = deliveredMessages.length
    ? new Date(Math.max(...deliveredMessages.map((item) => new Date(item.deliveredAt as string).getTime()))).toLocaleTimeString()
    : "None";
  const aiConfidence = state.diagnostics.length
    ? Math.round(state.diagnostics.reduce((sum, item) => sum + item.confidenceScore, 0) / state.diagnostics.length * 100)
    : 0;
  const workflowTitles = ["MT5 EA", "Bridge Authentication", "Heartbeat Channel", "Market Data Push", "Account Snapshot", "Signal Receiver", "Risk Validation", "Trade Command Router", "Execution Feedback", "Audit Log"];
  return {
    meta: { timestamp: now, currentRole: role, streamEndpoint: "/api/mt5/ea-bridge/events-stream", monitoringMode: "Autonomous Secure Bridge" },
    kpis: [
      { label: "Active EA Instances", value: String(instances.filter((item) => item.connectionStatus !== "Offline").length), status: "Healthy", detail: "Registered active agents", updatedAt: now },
      { label: "Connected Terminals", value: instances.length ? `${instances.filter((item) => item.connectionStatus === "Healthy").length}/${instances.length}` : "0/0", status: instances.length ? "Degraded" : "Inactive", detail: instances.length ? "Validated terminal bindings" : "No terminals linked", updatedAt: now },
      { label: "Live Bridge Sessions", value: String(state.sessions.filter((session) => session.status !== "Offline").length), status: "Healthy", detail: "Authenticated or monitored sessions", updatedAt: now },
      { label: "Message Throughput", value: `${state.sessions.reduce((sum, session) => sum + session.messageRatePerMinute, 0).toLocaleString()}/min`, status: "Healthy", detail: "Inbound and outbound events", updatedAt: now },
      { label: "Failed Messages", value: String(delivery.failed), status: delivery.failed ? "Critical" : "Healthy", detail: "Rejected or queued messages", updatedAt: now },
      { label: "Average Round Trip Latency", value: `${averageLatency} ms`, status: averageLatency > 200 ? "Degraded" : "Healthy", detail: "Bridge session average", updatedAt: now },
      { label: "Trade Command Success Rate", value: `${Math.round(successfulCommands / Math.max(1, state.commands.length) * 100)}%`, status: "Degraded", detail: "Commands executed by MT5", updatedAt: now },
      { label: "Market Data Stream Health", value: `${delivery.reliability}%`, status: delivery.reliability >= 75 ? "Healthy" : "Degraded", detail: "Signed message delivery reliability", updatedAt: now },
      { label: "Authentication Failures", value: String(instances.reduce((sum, item) => sum + item.failedAuthenticationAttempts, 0)), status: "Critical", detail: "Token/session rejects", updatedAt: now },
      { label: "Last Successful Message", value: lastSuccessfulMessage, status: deliveredMessages.length ? "Healthy" : "Inactive", detail: "Confirmed delivery", updatedAt: now },
      { label: "Bridge Risk Level", value: bridgeHealth.rating, status: bridgeHealth.score >= 75 ? "Healthy" : bridgeHealth.score >= 60 ? "Degraded" : "Critical", detail: `${bridgeHealth.score}/100 score`, updatedAt: now },
      { label: "AI Confidence Score", value: `${aiConfidence}%`, status: state.diagnostics.length ? "Syncing" : "Inactive", detail: "AI bridge diagnosis", updatedAt: now }
    ],
    bridgeHealth,
    workflow: workflowTitles.map((title, index) => ({
      title, status: index === 1 && authenticated < 70 ? "Critical" : index > 4 && bridgeHealth.score < 60 ? "Degraded" : "Healthy",
      currentCount: index < 3 ? instances.length : delivery.delivered, failureCount: index === 1 ? state.sessions.filter((session) => session.authStatus === "Rejected").length : delivery.failed,
      averageDelayMs: averageLatency, lastEventAt: now, aiRecommendation: index === 1 ? "Rotate compromised token and preserve command block." : undefined
    })),
    instances: instances.map(redactInstance), sessions: state.sessions, messages: state.messages, commands: state.commands, logs: state.logs, diagnostics: state.diagnostics, audits: state.audits,
    permissions: {
      role, canSync: permissions.sync.includes(role), canDiagnostics: permissions.diagnostics.includes(role), canRestart: permissions.restart.includes(role),
      canRotateToken: permissions.rotateToken.includes(role), canReissuePairing: permissions.reissuePairing.includes(role), canTradeControl: permissions.tradeControl.includes(role), canRebindTerminal: permissions.rebindTerminal.includes(role),
      canEmergencyDisable: permissions.emergencyDisable.includes(role), canAutoRemediate: permissions.autoRemediate.includes(role)
    },
    activePairing: Object.fromEntries(
      instances.map((instance) => {
        const secrets = credentialSecrets(instance.id);
        return [
          instance.id,
          {
            ingestionToken: secrets?.ingestionTokenHint,
            signingSecret: secrets?.signingSecretHint,
            tokenCreatedAt: instance.tokenCreatedAt
          }
        ];
      })
    )
  };
}

export function bridgeSummary(role: Mt5Role) {
  const response = buildEaBridgeResponse(role);
  return { meta: response.meta, kpis: response.kpis, bridgeHealth: response.bridgeHealth, workflow: response.workflow, permissions: response.permissions };
}

import type { BridgeMessage, BridgeScore, EaInstance, TokenRisk, TradeCommand } from "../types/ea-bridge.types";

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function rating(score: number): BridgeScore["rating"] {
  if (score >= 90) return "Excellent";
  if (score >= 75) return "Healthy";
  if (score >= 60) return "Degraded";
  if (score >= 40) return "High Risk";
  return "Critical";
}

export function calculateDeliveryReliability(messages: BridgeMessage[]) {
  const total = Math.max(1, messages.length);
  const delivered = messages.filter((message) => message.status === "Delivered").length;
  const retries = messages.reduce((sum, message) => sum + message.retryCount, 0);
  const duplicateCount = messages.filter((message) => message.failureReason?.toLowerCase().includes("duplicate")).length;
  const schemaErrors = messages.filter((message) => message.failureReason?.toLowerCase().includes("schema")).length;
  const processingTimeMs = Math.round(messages.reduce((sum, message) => sum + message.processingTimeMs, 0) / total);
  const retryPenalty = retries * 2;
  const duplicatePenalty = duplicateCount * 6;
  const reliability = clamp(delivered / total * 100 - retryPenalty - duplicatePenalty);
  return { reliability, total, delivered, failed: total - delivered, retries, duplicateCount, schemaErrors, processingTimeMs };
}

export function calculateBridgeHealth(input: {
  heartbeatPercent: number;
  authenticationPercent: number;
  messages: BridgeMessage[];
  averageLatencyMs: number;
  commandSuccessPercent: number;
  feedbackPercent: number;
  errorCount: number;
}) {
  const delivery = calculateDeliveryReliability(input.messages);
  const factors = {
    heartbeat: Math.min(18, input.heartbeatPercent * 0.18),
    authentication: Math.min(16, input.authenticationPercent * 0.16),
    messageDelivery: Math.min(20, delivery.reliability * 0.2),
    latency: input.averageLatencyMs <= 80 ? 14 : input.averageLatencyMs <= 200 ? 10 : input.averageLatencyMs <= 400 ? 5 : 0,
    commandSuccess: Math.min(18, input.commandSuccessPercent * 0.18),
    feedback: Math.min(14, input.feedbackPercent * 0.14),
    errorPenalty: input.errorCount * -4,
    retryPenalty: delivery.retries * -2
  };
  const score = clamp(Object.values(factors).reduce((sum, value) => sum + value, 0));
  return { score, rating: rating(score), factors, delivery };
}

export function classifyTokenRisk(instance: EaInstance, now = Date.now()): TokenRisk {
  const ageDays = (now - new Date(instance.tokenCreatedAt).getTime()) / 86_400_000;
  let points = ageDays > 90 ? 35 : ageDays > 60 ? 20 : ageDays > 30 ? 10 : 0;
  points += instance.failedAuthenticationAttempts * 12;
  if (instance.currentIpAddress !== instance.knownIpAddress) points += 22;
  if (!instance.knownDeviceFingerprint) points += 20;
  if (instance.activeSessionCount > 1) points += (instance.activeSessionCount - 1) * 12;
  if (instance.permissionMismatch) points += 24;
  if (instance.tokenStatus === "Compromised" || instance.tokenStatus === "Revoked") points = 100;
  return points >= 80 ? "Critical" : points >= 60 ? "High" : points >= 40 ? "Medium" : points >= 20 ? "Watch" : "Low";
}

export function validateBridgePayload(input: { schemaVersion: string; nonce: string; timestamp: string; signed: boolean; usedNonces: Set<string>; now?: number }) {
  const now = input.now ?? Date.now();
  if (!input.signed) return { valid: false, reason: "Signed payload validation failed." };
  if (input.schemaVersion !== "v1.0") return { valid: false, reason: "Schema validation error: unsupported version." };
  if (!input.nonce || input.usedNonces.has(input.nonce)) return { valid: false, reason: "Nonce replay protection rejected duplicate payload." };
  if (Math.abs(now - new Date(input.timestamp).getTime()) > 60_000) return { valid: false, reason: "Timestamp replay window expired." };
  return { valid: true as const };
}

export function isDuplicateCommand(candidate: TradeCommand, existing: TradeCommand[], windowMs = 30_000) {
  return existing.some((command) => {
    const sameIdentity = command.commandUuid === candidate.commandUuid;
    const sameTrade = command.accountId === candidate.accountId && command.symbol === candidate.symbol && command.commandType === candidate.commandType &&
      command.direction === candidate.direction && command.volume === candidate.volume && command.strategyId === candidate.strategyId;
    const withinWindow = Math.abs(new Date(candidate.signalTimestamp).getTime() - new Date(command.signalTimestamp).getTime()) <= windowMs;
    return sameIdentity || (sameTrade && withinWindow);
  });
}

export function canDeliverTradeCommand(instance: EaInstance, tokenRisk: TokenRisk) {
  if (!instance.tradingChannelEnabled) return { allowed: false, reason: "EA trading channel is disabled." };
  if (tokenRisk === "High" || tokenRisk === "Critical") return { allowed: false, reason: "Token risk policy blocks commands." };
  if (instance.connectionStatus !== "Healthy") return { allowed: false, reason: "Bridge connection is not healthy." };
  return { allowed: true, reason: "Bridge command path validated." };
}

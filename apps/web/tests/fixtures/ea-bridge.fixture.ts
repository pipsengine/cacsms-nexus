import type { BridgeDiagnostic, BridgeLog, BridgeMessage, BridgeSession, EaInstance, TradeCommand } from "@/modules/mt5-infrastructure-and-broker-connectivity/ea-bridge/types/ea-bridge.types";

const ago = (seconds: number) => new Date(Date.now() - seconds * 1000).toISOString();

export function createEaBridgeSeed() {
  const instances: EaInstance[] = [
    {
      id: "ea-ld4-01", eaInstanceUuid: "ea-uuid-ld4-001", eaName: "NexusExecutionEA", terminalId: "term-ld4-01", terminalName: "MT5-Live-01",
      brokerId: "broker-icm", brokerName: "IC Markets", accountId: "acct-1", accountLogin: "73018421", symbolScope: ["EURUSD", "XAUUSD", "NAS100"],
      eaVersion: "3.8.1", buildNumber: 381, bridgeTokenHash: "sha256:8ddf...2c10", tokenStatus: "Valid", tokenCreatedAt: ago(86400 * 12),
      failedAuthenticationAttempts: 0, knownIpAddress: "10.44.1.12", currentIpAddress: "10.44.1.12", knownDeviceFingerprint: true, activeSessionCount: 1,
      permissionMismatch: false, connectionStatus: "Healthy", heartbeatStatus: "Healthy", lastHeartbeatAt: ago(2), messageCount: 948_220,
      failedMessageCount: 3, averageLatencyMs: 38, tradingChannelEnabled: true, riskLevel: "Healthy", lastError: null, updatedAt: ago(2)
    },
    {
      id: "ea-ny4-02", eaInstanceUuid: "ea-uuid-ny4-002", eaName: "NexusFailoverEA", terminalId: "term-ny4-02", terminalName: "MT5-Failover-02",
      brokerId: "broker-pepper", brokerName: "Pepperstone", accountId: "acct-2", accountLogin: "54290016", symbolScope: ["EURUSD", "GBPUSD", "US30"],
      eaVersion: "3.8.1", buildNumber: 381, bridgeTokenHash: "sha256:ab90...ef71", tokenStatus: "Expiring", tokenCreatedAt: ago(86400 * 68),
      failedAuthenticationAttempts: 1, knownIpAddress: "10.58.2.17", currentIpAddress: "10.58.2.17", knownDeviceFingerprint: true, activeSessionCount: 1,
      permissionMismatch: false, connectionStatus: "Degraded", heartbeatStatus: "Watch", lastHeartbeatAt: ago(43), messageCount: 622_105,
      failedMessageCount: 64, averageLatencyMs: 274, tradingChannelEnabled: true, riskLevel: "Degraded", lastError: "Bridge latency threshold exceeded.", updatedAt: ago(43)
    },
    {
      id: "ea-fra-03", eaInstanceUuid: "ea-uuid-fra-003", eaName: "NexusPropEA", terminalId: "term-fra-03", terminalName: "MT5-Prop-03",
      brokerId: "broker-ftmo", brokerName: "FTMO", accountId: "acct-3", accountLogin: "88731690", symbolScope: ["EURUSD", "NAS100"],
      eaVersion: "3.7.4", buildNumber: 374, bridgeTokenHash: "sha256:comp...0000", tokenStatus: "Compromised", tokenCreatedAt: ago(86400 * 102),
      failedAuthenticationAttempts: 5, knownIpAddress: "10.75.3.23", currentIpAddress: "185.27.77.14", knownDeviceFingerprint: false, activeSessionCount: 2,
      permissionMismatch: true, connectionStatus: "Critical", heartbeatStatus: "Critical", lastHeartbeatAt: ago(188), messageCount: 104_112,
      failedMessageCount: 248, averageLatencyMs: 521, tradingChannelEnabled: false, riskLevel: "Critical", lastError: "Authentication rejected: token fingerprint mismatch.", updatedAt: ago(188)
    }
  ];
  const sessions: BridgeSession[] = [
    { id: "sess-1", sessionUuid: "ws-session-ld4-001", eaInstanceId: "ea-ld4-01", eaInstanceName: "NexusExecutionEA", terminalName: "MT5-Live-01", brokerName: "IC Markets", accountLogin: "73018421", ipAddress: "10.44.1.12", protocol: "WebSocket", authStatus: "Authenticated", connectionStartedAt: ago(65_200), lastMessageAt: ago(1), sessionDurationSeconds: 65_200, messageRatePerMinute: 1280, latencyMs: 38, status: "Healthy" },
    { id: "sess-2", sessionUuid: "ws-session-ny4-002", eaInstanceId: "ea-ny4-02", eaInstanceName: "NexusFailoverEA", terminalName: "MT5-Failover-02", brokerName: "Pepperstone", accountLogin: "54290016", ipAddress: "10.58.2.17", protocol: "WebSocket", authStatus: "Expiring", connectionStartedAt: ago(22_480), lastMessageAt: ago(43), sessionDurationSeconds: 22_480, messageRatePerMinute: 510, latencyMs: 274, status: "Degraded" },
    { id: "sess-3", sessionUuid: "https-session-fra-003", eaInstanceId: "ea-fra-03", eaInstanceName: "NexusPropEA", terminalName: "MT5-Prop-03", brokerName: "FTMO", accountLogin: "88731690", ipAddress: "185.27.77.14", protocol: "HTTPS Signed Push", authStatus: "Rejected", connectionStartedAt: ago(800), lastMessageAt: ago(188), sessionDurationSeconds: 800, messageRatePerMinute: 3, latencyMs: 521, status: "Critical" }
  ];
  const messages: BridgeMessage[] = [
    { id: "msg-1", messageUuid: "msg-heartbeat-001", eaInstanceId: "ea-ld4-01", sessionId: "sess-1", messageType: "Heartbeat", source: "NexusExecutionEA", destination: "Bridge Monitor", payloadHash: "sha256:hb01", schemaVersion: "v1.0", nonce: "nonce-001", signed: true, status: "Delivered", retryCount: 0, processingTimeMs: 12, createdAt: ago(2), deliveredAt: ago(2) },
    { id: "msg-2", messageUuid: "msg-tick-002", eaInstanceId: "ea-ld4-01", sessionId: "sess-1", messageType: "Tick Data", source: "NexusExecutionEA", destination: "Market Data Service", payloadHash: "sha256:tick02", schemaVersion: "v1.0", nonce: "nonce-002", signed: true, status: "Delivered", retryCount: 0, processingTimeMs: 18, createdAt: ago(3), deliveredAt: ago(3) },
    { id: "msg-3", messageUuid: "msg-account-003", eaInstanceId: "ea-ny4-02", sessionId: "sess-2", messageType: "Account Snapshot", source: "NexusFailoverEA", destination: "Account Sync", payloadHash: "sha256:acct03", schemaVersion: "v1.0", nonce: "nonce-003", signed: true, status: "Retrying", retryCount: 2, processingTimeMs: 310, failureReason: "Timeout waiting for account service.", createdAt: ago(49) },
    { id: "msg-4", messageUuid: "msg-exec-004", eaInstanceId: "ea-ld4-01", sessionId: "sess-1", messageType: "Trade Execution Result", source: "NexusExecutionEA", destination: "Execution Feedback", payloadHash: "sha256:exec04", schemaVersion: "v1.0", nonce: "nonce-004", signed: true, status: "Delivered", retryCount: 0, processingTimeMs: 41, createdAt: ago(67), deliveredAt: ago(67) },
    { id: "msg-5", messageUuid: "msg-invalid-005", eaInstanceId: "ea-fra-03", sessionId: "sess-3", messageType: "Trade Request", source: "NexusPropEA", destination: "Trade Router", payloadHash: "sha256:invalid05", schemaVersion: "v0.8", nonce: "nonce-005", signed: false, status: "Rejected", retryCount: 0, processingTimeMs: 4, failureReason: "Schema validation error and invalid signature.", createdAt: ago(190) },
    { id: "msg-6", messageUuid: "msg-dup-006", eaInstanceId: "ea-fra-03", sessionId: "sess-3", messageType: "Trade Request", source: "NexusPropEA", destination: "Trade Router", payloadHash: "sha256:dup06", schemaVersion: "v1.0", nonce: "nonce-004", signed: true, status: "Rejected", retryCount: 0, processingTimeMs: 5, failureReason: "Duplicate nonce replay detected.", createdAt: ago(195) },
    { id: "msg-7", messageUuid: "msg-risk-007", eaInstanceId: "ea-fra-03", sessionId: "sess-3", messageType: "Risk Alert", source: "Nexus Risk Engine", destination: "Audit Service", payloadHash: "sha256:risk07", schemaVersion: "v1.0", nonce: "nonce-007", signed: true, status: "Delivered", retryCount: 0, processingTimeMs: 22, createdAt: ago(187), deliveredAt: ago(187) }
  ];
  const commands: TradeCommand[] = [
    { id: "cmd-1", commandUuid: "command-001", eaInstanceId: "ea-ld4-01", accountId: "acct-1", accountLogin: "73018421", symbol: "EURUSD", commandType: "Market", direction: "Buy", volume: 0.8, requestedPrice: 1.0842, stopLoss: 1.081, takeProfit: 1.09, riskApprovalStatus: "Approved", deliveryStatus: "Delivered", executionStatus: "Executed", responseTimeMs: 44, signalTimestamp: ago(70), strategyId: "liquidity-v3", createdAt: ago(70), executedAt: ago(69) },
    { id: "cmd-2", commandUuid: "command-002", eaInstanceId: "ea-ny4-02", accountId: "acct-2", accountLogin: "54290016", symbol: "GBPUSD", commandType: "Limit", direction: "Sell", volume: 0.4, requestedPrice: 1.2732, riskApprovalStatus: "Approved", deliveryStatus: "Delivered", executionStatus: "Pending", responseTimeMs: 288, signalTimestamp: ago(58), strategyId: "range-v1", createdAt: ago(58) },
    { id: "cmd-3", commandUuid: "command-003", eaInstanceId: "ea-fra-03", accountId: "acct-3", accountLogin: "88731690", symbol: "NAS100", commandType: "Market", direction: "Buy", volume: 1, requestedPrice: 21882.4, riskApprovalStatus: "Blocked", deliveryStatus: "Blocked", executionStatus: "Rejected", responseTimeMs: 6, rejectionReason: "Token risk critical and EA trading channel disabled.", signalTimestamp: ago(180), strategyId: "breakout-v2", createdAt: ago(180) }
  ];
  const logs: BridgeLog[] = [
    { id: "log-1", eaInstanceId: "ea-fra-03", eaInstanceName: "NexusPropEA", terminalName: "MT5-Prop-03", accountLogin: "88731690", logType: "Authentication", severity: "Critical", message: "Bridge authentication failed from unknown IP address.", technicalDetails: "Fingerprint mismatch; compromised token status recorded.", resolved: false, createdAt: ago(188) },
    { id: "log-2", eaInstanceId: "ea-fra-03", eaInstanceName: "NexusPropEA", terminalName: "MT5-Prop-03", accountLogin: "88731690", logType: "Schema", severity: "Critical", message: "Invalid EA trade payload rejected.", technicalDetails: "Unsupported schema v0.8; signature=false", resolved: false, createdAt: ago(190) },
    { id: "log-3", eaInstanceId: "ea-fra-03", eaInstanceName: "NexusPropEA", terminalName: "MT5-Prop-03", accountLogin: "88731690", logType: "Duplicate", severity: "Warning", message: "Duplicate trade command nonce blocked.", technicalDetails: "Nonce replay window: 60 seconds", resolved: false, createdAt: ago(195) },
    { id: "log-4", eaInstanceId: "ea-ny4-02", eaInstanceName: "NexusFailoverEA", terminalName: "MT5-Failover-02", accountLogin: "54290016", logType: "Timeout", severity: "Warning", message: "Account snapshot delivery retry scheduled.", technicalDetails: "Attempt 2; upstream timeout 300ms", resolved: false, createdAt: ago(49) }
  ];
  const diagnostics: BridgeDiagnostic[] = [
    { id: "bridge-diag-1", eaInstanceId: "ea-fra-03", affectedComponent: "NexusPropEA / MT5-Prop-03 / 88731690", issue: "Token misuse and unsigned command payload", severity: "Critical", rootCause: "Unknown IP fingerprint attempted an expired-schema trade request using a compromised bridge token.", businessImpact: "Unauthorized trade injection risk; command delivery is blocked.", recommendation: "Keep the trading channel disabled, rotate token, rebind trusted terminal, and re-authenticate session.", confidenceScore: 0.98, autoFixEligible: true, autoFixStatus: "Approval Required", escalationRequired: true, createdAt: ago(185) },
    { id: "bridge-diag-2", eaInstanceId: "ea-ny4-02", affectedComponent: "NexusFailoverEA / MT5-Failover-02 / 54290016", issue: "Bridge latency spike and delivery retry backlog", severity: "Warning", rootCause: "Round-trip latency increased to 274ms and account snapshots entered retry state.", businessImpact: "Failover execution feedback may arrive late.", recommendation: "Run bridge diagnostics and rotate token during the next controlled window if auth expiry persists.", confidenceScore: 0.9, autoFixEligible: true, autoFixStatus: "Available", escalationRequired: false, createdAt: ago(45) }
  ];
  return { instances, sessions, messages, commands, logs, diagnostics };
}

import type {
  BrokerConnection,
  BrokerConnectionTest,
  BrokerDiagnostic,
  BrokerExecutionQuality,
  BrokerIncident,
  BrokerLatencyLog,
  BrokerSpreadLog
} from "../types/broker-connections.types";

const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

export function createBrokerConnectionsSeed() {
  const brokers: BrokerConnection[] = [
    {
      id: "broker-icm", brokerId: "BRK-001", brokerName: "IC Markets", brokerCode: "ICM", mt5ServerName: "ICMarketsSC-Live33", serverRegion: "London",
      connectionMode: "MT5 TCP + FIX", supportedAccountTypes: ["Raw Spread", "Standard"], supportedInstruments: ["FX", "Metals", "Indices"], timezone: "UTC+2", tradingSessions: "24x5",
      connectionStatus: "Healthy", loginStatus: "Healthy", dataFeedStatus: "Healthy", executionStatus: "Healthy", serverReachable: true, loginSuccessRate: 99.8,
      lastSuccessfulLoginAt: ago(6), failedLoginCount: 0, averageLatencyMs: 38, packetLossPercent: 0.1, heartbeatDelaySeconds: 3, uptimePercent: 99.98,
      spreadStabilityScore: 97, slippageScore: 96, requoteRate: 0.2, rejectionRate: 0.1, fillQualityScore: 98, averageExecutionTimeMs: 74, executionEnabled: true,
      lastRejectedOrderReason: null, dataFeedActive: true, lastTickAt: ago(0.03), tickDelaySeconds: 1, candleSyncStatus: "Healthy", frozenFeedStatus: "Healthy",
      spreadWideningStatus: "Healthy", missingDataGapCount: 0, lastConnectedAt: ago(8430), lastDisconnectedAt: null, lastErrorMessage: null, riskLevel: "Healthy", healthScore: 98, updatedAt: ago(0)
    },
    {
      id: "broker-pepper", brokerId: "BRK-002", brokerName: "Pepperstone", brokerCode: "PEP", mt5ServerName: "Pepperstone-Edge09", serverRegion: "New York",
      connectionMode: "MT5 TCP", supportedAccountTypes: ["Razor"], supportedInstruments: ["FX", "Gold", "NASDAQ"], timezone: "UTC-4", tradingSessions: "24x5",
      connectionStatus: "Degraded", loginStatus: "Healthy", dataFeedStatus: "Degraded", executionStatus: "Degraded", serverReachable: true, loginSuccessRate: 96.2,
      lastSuccessfulLoginAt: ago(19), failedLoginCount: 2, averageLatencyMs: 184, packetLossPercent: 1.7, heartbeatDelaySeconds: 24, uptimePercent: 98.72,
      spreadStabilityScore: 68, slippageScore: 72, requoteRate: 3.9, rejectionRate: 2.7, fillQualityScore: 70, averageExecutionTimeMs: 292, executionEnabled: true,
      lastRejectedOrderReason: "Price changed during volatile spread expansion", dataFeedActive: true, lastTickAt: ago(0.8), tickDelaySeconds: 47, candleSyncStatus: "Watch", frozenFeedStatus: "Healthy",
      spreadWideningStatus: "Degraded", missingDataGapCount: 2, lastConnectedAt: ago(2410), lastDisconnectedAt: ago(2420), lastErrorMessage: "Tick stream jitter above baseline", riskLevel: "Degraded", healthScore: 68, updatedAt: ago(1)
    },
    {
      id: "broker-ftmo", brokerId: "BRK-003", brokerName: "FTMO", brokerCode: "FTMO", mt5ServerName: "FTMO-Server3", serverRegion: "Frankfurt",
      connectionMode: "MT5 TCP", supportedAccountTypes: ["Challenge", "Funded"], supportedInstruments: ["FX", "Indices"], timezone: "UTC+2", tradingSessions: "24x5",
      connectionStatus: "Offline", loginStatus: "Critical", dataFeedStatus: "Offline", executionStatus: "Critical", serverReachable: false, loginSuccessRate: 41,
      lastSuccessfulLoginAt: ago(96), failedLoginCount: 17, averageLatencyMs: 612, packetLossPercent: 18.4, heartbeatDelaySeconds: 310, uptimePercent: 78.2,
      spreadStabilityScore: 22, slippageScore: 19, requoteRate: 19.8, rejectionRate: 31.4, fillQualityScore: 16, averageExecutionTimeMs: 884, executionEnabled: false,
      lastRejectedOrderReason: "Off quotes: server unavailable", dataFeedActive: false, lastTickAt: ago(12), tickDelaySeconds: 720, candleSyncStatus: "Offline", frozenFeedStatus: "Critical",
      spreadWideningStatus: "Critical", missingDataGapCount: 18, lastConnectedAt: ago(210), lastDisconnectedAt: ago(94), lastErrorMessage: "Authentication loop after server disconnect", riskLevel: "Critical", healthScore: 18, updatedAt: ago(2)
    },
    {
      id: "broker-eightcap", brokerId: "BRK-004", brokerName: "Eightcap", brokerCode: "ECP", mt5ServerName: "Eightcap-Live02", serverRegion: "Sydney",
      connectionMode: "MT5 TCP + REST", supportedAccountTypes: ["Raw"], supportedInstruments: ["FX", "Metals", "Indices"], timezone: "UTC+10", tradingSessions: "24x5",
      connectionStatus: "Healthy", loginStatus: "Healthy", dataFeedStatus: "Healthy", executionStatus: "Healthy", serverReachable: true, loginSuccessRate: 99.1,
      lastSuccessfulLoginAt: ago(7), failedLoginCount: 1, averageLatencyMs: 92, packetLossPercent: 0.4, heartbeatDelaySeconds: 7, uptimePercent: 99.43,
      spreadStabilityScore: 90, slippageScore: 88, requoteRate: 0.8, rejectionRate: 0.6, fillQualityScore: 91, averageExecutionTimeMs: 121, executionEnabled: true,
      lastRejectedOrderReason: null, dataFeedActive: true, lastTickAt: ago(0.08), tickDelaySeconds: 2, candleSyncStatus: "Healthy", frozenFeedStatus: "Healthy",
      spreadWideningStatus: "Healthy", missingDataGapCount: 0, lastConnectedAt: ago(3980), lastDisconnectedAt: ago(4200), lastErrorMessage: null, riskLevel: "Healthy", healthScore: 91, updatedAt: ago(0)
    }
  ];
  const incidents: BrokerIncident[] = [
    { id: "incident-ftmo-login", brokerId: "broker-ftmo", brokerName: "FTMO", serverName: "FTMO-Server3", accountLogin: "58422091", incidentType: "Login Failure", severity: "Critical", errorCode: "AUTH-401", errorMessage: "Repeated MT5 authorization rejected.", rootCause: "Broker session is disconnected and credential handshake is timing out.", actionTaken: "Execution disabled; reconnect quarantined.", autoResolved: false, resolutionStatus: "Open", createdAt: ago(9) },
    { id: "incident-ftmo-feed", brokerId: "broker-ftmo", brokerName: "FTMO", serverName: "FTMO-Server3", accountLogin: "58422091", incidentType: "Market Data Issue", severity: "Critical", errorCode: "FEED-408", errorMessage: "No tick delivery received for 12 minutes.", rootCause: "Server connection loss froze the quote stream.", actionTaken: "Routing removed from eligible brokers.", autoResolved: false, resolutionStatus: "Open", createdAt: ago(11) },
    { id: "incident-pep-spread", brokerId: "broker-pepper", brokerName: "Pepperstone", serverName: "Pepperstone-Edge09", accountLogin: "85100122", incidentType: "Spread Spike", severity: "Warning", errorCode: "SPREAD-201", errorMessage: "EURUSD spread exceeded rolling threshold.", rootCause: "Transient feed volatility with increased server jitter.", actionTaken: "Monitor and compare peer pricing.", autoResolved: false, resolutionStatus: "Monitoring", createdAt: ago(6) },
    { id: "incident-icm-recovery", brokerId: "broker-icm", brokerName: "IC Markets", serverName: "ICMarketsSC-Live33", accountLogin: "77194850", incidentType: "Recovery", severity: "Info", errorCode: "OK-200", errorMessage: "Connection test completed.", rootCause: "Scheduled validation.", actionTaken: "No intervention required.", autoResolved: true, resolutionStatus: "Resolved", resolvedAt: ago(38), createdAt: ago(39) }
  ];
  const tests: BrokerConnectionTest[] = [
    { id: "test-icm-1", brokerId: "broker-icm", testType: "Full Connectivity", testStatus: "Healthy", latencyMs: 38, loginSuccess: true, dataFeedSuccess: true, executionGatewaySuccess: true, symbolSyncSuccess: true, accountSyncSuccess: true, failureReason: null, testedBy: "autonomous-monitor", createdAt: ago(39) }
  ];
  const latencyLogs: BrokerLatencyLog[] = brokers.flatMap((broker, index) =>
    [15, 10, 5, 0].map((minutes, sample) => ({
      id: `lat-${index}-${sample}`, brokerId: broker.id, brokerName: broker.brokerName,
      latencyMs: Math.max(20, broker.averageLatencyMs - (3 - sample) * (broker.id === "broker-ftmo" ? 42 : 5)),
      packetLossPercent: broker.packetLossPercent, heartbeatDelaySeconds: broker.heartbeatDelaySeconds, serverReachable: broker.serverReachable, measuredAt: ago(minutes)
    }))
  );
  const spreadLogs: BrokerSpreadLog[] = [
    { id: "spr-icm-eur", brokerId: "broker-icm", brokerName: "IC Markets", symbol: "EURUSD", spreadPoints: 2, averageSpreadPoints: 2, spreadStabilityScore: 98, abnormalSpreadDetected: false, measuredAt: ago(1) },
    { id: "spr-icm-xau", brokerId: "broker-icm", brokerName: "IC Markets", symbol: "XAUUSD", spreadPoints: 13, averageSpreadPoints: 12, spreadStabilityScore: 96, abnormalSpreadDetected: false, measuredAt: ago(1) },
    { id: "spr-pep-eur", brokerId: "broker-pepper", brokerName: "Pepperstone", symbol: "EURUSD", spreadPoints: 8, averageSpreadPoints: 3, spreadStabilityScore: 58, abnormalSpreadDetected: true, measuredAt: ago(5) },
    { id: "spr-ftmo-eur", brokerId: "broker-ftmo", brokerName: "FTMO", symbol: "EURUSD", spreadPoints: 25, averageSpreadPoints: 4, spreadStabilityScore: 18, abnormalSpreadDetected: true, measuredAt: ago(8) },
    { id: "spr-ftmo-xau", brokerId: "broker-ftmo", brokerName: "FTMO", symbol: "XAUUSD", spreadPoints: 96, averageSpreadPoints: 28, spreadStabilityScore: 12, abnormalSpreadDetected: true, measuredAt: ago(8) },
    { id: "spr-ecp-eur", brokerId: "broker-eightcap", brokerName: "Eightcap", symbol: "EURUSD", spreadPoints: 3, averageSpreadPoints: 3, spreadStabilityScore: 91, abnormalSpreadDetected: false, measuredAt: ago(1) }
  ];
  const executionQuality: BrokerExecutionQuality[] = [
    { id: "exec-icm", brokerId: "broker-icm", brokerName: "IC Markets", accountId: "a1", symbol: "EURUSD", orderType: "Market Buy", executionTimeMs: 74, slippagePoints: 0.2, requoteDetected: false, rejected: false, fillQualityScore: 98, createdAt: ago(4) },
    { id: "exec-pep-1", brokerId: "broker-pepper", brokerName: "Pepperstone", accountId: "a2", symbol: "XAUUSD", orderType: "Market Sell", executionTimeMs: 318, slippagePoints: 5.4, requoteDetected: true, rejected: false, fillQualityScore: 61, createdAt: ago(6) },
    { id: "exec-pep-2", brokerId: "broker-pepper", brokerName: "Pepperstone", accountId: "a2", symbol: "EURUSD", orderType: "Market Buy", executionTimeMs: 279, slippagePoints: 3.8, requoteDetected: false, rejected: false, fillQualityScore: 72, createdAt: ago(7) },
    { id: "exec-ftmo-1", brokerId: "broker-ftmo", brokerName: "FTMO", accountId: "a3", symbol: "EURUSD", orderType: "Market Buy", executionTimeMs: 904, slippagePoints: 18, requoteDetected: true, rejected: true, rejectionReason: "Off quotes", fillQualityScore: 8, createdAt: ago(12) },
    { id: "exec-ftmo-2", brokerId: "broker-ftmo", brokerName: "FTMO", accountId: "a3", symbol: "XAUUSD", orderType: "Market Sell", executionTimeMs: 864, slippagePoints: 22, requoteDetected: true, rejected: true, rejectionReason: "Server unavailable", fillQualityScore: 4, createdAt: ago(14) },
    { id: "exec-ecp", brokerId: "broker-eightcap", brokerName: "Eightcap", accountId: "a4", symbol: "NASDAQ", orderType: "Market Buy", executionTimeMs: 121, slippagePoints: 1.2, requoteDetected: false, rejected: false, fillQualityScore: 92, createdAt: ago(5) }
  ];
  const diagnostics: BrokerDiagnostic[] = [
    { id: "diag-ftmo", brokerId: "broker-ftmo", affectedBroker: "FTMO", issue: "Broker offline with frozen market data and failed login loop", severity: "Critical", rootCause: "Server reachability failed after disconnect; authentication retries continue without a valid quote stream.", tradingImpact: "Orders routed to this broker could reject or execute against stale prices.", recommendation: "Keep execution disabled, attempt controlled reconnect, and route eligible orders to IC Markets.", confidenceScore: 0.96, autoRemediationAvailable: true, autoRemediationStatus: "Available", escalationRequired: true, createdAt: ago(7) },
    { id: "diag-pep", brokerId: "broker-pepper", affectedBroker: "Pepperstone", issue: "Latency and spread stability degradation", severity: "Warning", rootCause: "Network jitter coincides with elevated EURUSD spreads and execution delay.", tradingImpact: "Entry prices may incur additional slippage in fast markets.", recommendation: "Monitor peer spreads and run a gateway test before increasing order flow.", confidenceScore: 0.88, autoRemediationAvailable: true, autoRemediationStatus: "Available", escalationRequired: false, createdAt: ago(5) }
  ];
  return { brokers, incidents, tests, latencyLogs, spreadLogs, executionQuality, diagnostics };
}

import type { HeartbeatLog, TerminalAiDiagnostic, TerminalErrorLog, TerminalEvent, TerminalStatusRecord } from "@/modules/mt5-infrastructure-and-broker-connectivity/terminal-status/types/terminal-status.types";

const ago = (seconds: number) => new Date(Date.now() - seconds * 1000).toISOString();

export function createTerminalStatusSeed() {
  const terminals: TerminalStatusRecord[] = [
    {
      id: "status-ld4-01", terminalId: "term-ld4-01", terminalUuid: "mt5-ld4-0001", terminalName: "MT5-Live-01", brokerId: "broker-icm", brokerName: "IC Markets",
      accountId: "acct-1", accountLogin: "73018421", accountType: "Live", accountCurrency: "USD", serverName: "ICMarketsSC-Live23", hostMachine: "VPS-LD4-01",
      ipAddress: "10.44.1.12", operatingSystem: "Windows Server 2022", region: "London LD4", timezone: "UTC", terminalPath: "C:\\MT5\\Live01\\terminal64.exe",
      terminalVersion: "5.00", buildNumber: 4770, processStatus: "Running", processId: 6024, startupTime: ago(2_391_020), connectionStatus: "Healthy",
      heartbeatStatus: "Healthy", lastHeartbeatAt: ago(3), expectedHeartbeatIntervalSeconds: 15, heartbeatDelaySeconds: 3, missedHeartbeatCount: 0, cpuUsagePercent: 21,
      memoryUsagePercent: 44, diskUsagePercent: 36, networkLatencyMs: 42, packetLossPercent: 0.1, logFileSizeMb: 44, dataFolderSizeMb: 622,
      uptimeSeconds: 2_391_020, tradingEnabled: true, expertAdvisorsEnabled: true, dllImportsEnabled: true, accountTradeAllowed: true, marketDataActive: true,
      symbolMappingsValid: true, orderGatewayConnected: true, riskEngineConnected: true, openPositionsCount: 3, pendingOrdersCount: 0, lastErrorCode: null,
      lastErrorMessage: null, riskLevel: "Healthy", healthScore: 96, restartRequired: false, autoRestartEnabled: true, maintenanceMode: false, restartAttemptCount: 0,
      restartAttemptLimit: 3, highRiskTradeInProgress: false, accountSyncInProgress: false, lastMarketTickAt: ago(1), lastAccountUpdateAt: ago(8), logsUpdatedAt: ago(4), updatedAt: ago(3)
    },
    {
      id: "status-ny4-02", terminalId: "term-ny4-02", terminalUuid: "mt5-ny4-0002", terminalName: "MT5-Failover-02", brokerId: "broker-pepper", brokerName: "Pepperstone",
      accountId: "acct-2", accountLogin: "54290016", accountType: "Live", accountCurrency: "USD", serverName: "Pepperstone-Edge04", hostMachine: "VPS-NY4-02",
      ipAddress: "10.58.2.17", operatingSystem: "Windows Server 2022", region: "New York NY4", timezone: "UTC-04:00", terminalPath: "C:\\MT5\\Failover02\\terminal64.exe",
      terminalVersion: "5.00", buildNumber: 4770, processStatus: "Running", processId: 7776, startupTime: ago(604_921), connectionStatus: "Watch",
      heartbeatStatus: "Watch", lastHeartbeatAt: ago(47), expectedHeartbeatIntervalSeconds: 15, heartbeatDelaySeconds: 47, missedHeartbeatCount: 2, cpuUsagePercent: 67,
      memoryUsagePercent: 78, diskUsagePercent: 51, networkLatencyMs: 287, packetLossPercent: 2.4, logFileSizeMb: 186, dataFolderSizeMb: 1190,
      uptimeSeconds: 604_921, tradingEnabled: true, expertAdvisorsEnabled: true, dllImportsEnabled: true, accountTradeAllowed: true, marketDataActive: true,
      symbolMappingsValid: true, orderGatewayConnected: true, riskEngineConnected: true, openPositionsCount: 1, pendingOrdersCount: 0, lastErrorCode: "NET-201",
      lastErrorMessage: "Broker round-trip latency exceeded configured threshold.", riskLevel: "Degraded", healthScore: 67, restartRequired: false, autoRestartEnabled: true, maintenanceMode: false, restartAttemptCount: 0,
      restartAttemptLimit: 3, highRiskTradeInProgress: false, accountSyncInProgress: false, lastMarketTickAt: ago(18), lastAccountUpdateAt: ago(40), logsUpdatedAt: ago(36), updatedAt: ago(47)
    },
    {
      id: "status-fra-03", terminalId: "term-fra-03", terminalUuid: "mt5-fra-0003", terminalName: "MT5-Prop-03", brokerId: "broker-ftmo", brokerName: "FTMO",
      accountId: "acct-3", accountLogin: "88731690", accountType: "Prop Firm", accountCurrency: "USD", serverName: "FTMO-Server3", hostMachine: "VPS-FRA-03",
      ipAddress: "10.75.3.23", operatingSystem: "Windows Server 2019", region: "Frankfurt", timezone: "UTC+01:00", terminalPath: "C:\\MT5\\Prop03\\terminal64.exe",
      terminalVersion: "5.00", buildNumber: 4755, processStatus: "Running", processId: 4401, startupTime: ago(25_010), connectionStatus: "Critical",
      heartbeatStatus: "Critical", lastHeartbeatAt: ago(186), expectedHeartbeatIntervalSeconds: 15, heartbeatDelaySeconds: 186, missedHeartbeatCount: 12, cpuUsagePercent: 92,
      memoryUsagePercent: 89, diskUsagePercent: 77, networkLatencyMs: 510, packetLossPercent: 7.2, logFileSizeMb: 903, dataFolderSizeMb: 2120,
      uptimeSeconds: 25_010, tradingEnabled: false, expertAdvisorsEnabled: true, dllImportsEnabled: true, accountTradeAllowed: false, marketDataActive: false,
      symbolMappingsValid: false, orderGatewayConnected: false, riskEngineConnected: true, openPositionsCount: 0, pendingOrdersCount: 0, lastErrorCode: "AUTH-401",
      lastErrorMessage: "Broker login authentication rejected after reconnect.", riskLevel: "Critical", healthScore: 22, restartRequired: true, autoRestartEnabled: true, maintenanceMode: false, restartAttemptCount: 1,
      restartAttemptLimit: 3, highRiskTradeInProgress: false, accountSyncInProgress: false, lastMarketTickAt: ago(203), lastAccountUpdateAt: ago(530), logsUpdatedAt: ago(221), updatedAt: ago(186)
    },
    {
      id: "status-lon-04", terminalId: "term-lon-04", terminalUuid: "mt5-lon-0004", terminalName: "MT5-Research-04", brokerId: "broker-icm", brokerName: "IC Markets",
      accountId: "acct-4", accountLogin: "73018511", accountType: "Demo", accountCurrency: "USD", serverName: "ICMarketsSC-Demo09", hostMachine: "VPS-LD4-04",
      ipAddress: "10.44.1.44", operatingSystem: "Windows Server 2022", region: "London LD4", timezone: "UTC", terminalPath: "C:\\MT5\\Research04\\terminal64.exe",
      terminalVersion: "5.00", buildNumber: 4660, processStatus: "Stopped", processId: null, startupTime: ago(88_000), connectionStatus: "Offline",
      heartbeatStatus: "Offline", lastHeartbeatAt: ago(480), expectedHeartbeatIntervalSeconds: 15, heartbeatDelaySeconds: 480, missedHeartbeatCount: 31, cpuUsagePercent: 0,
      memoryUsagePercent: 4, diskUsagePercent: 29, networkLatencyMs: 0, packetLossPercent: 100, logFileSizeMb: 28, dataFolderSizeMb: 418,
      uptimeSeconds: 0, tradingEnabled: false, expertAdvisorsEnabled: false, dllImportsEnabled: false, accountTradeAllowed: false, marketDataActive: false,
      symbolMappingsValid: true, orderGatewayConnected: false, riskEngineConnected: true, openPositionsCount: 0, pendingOrdersCount: 0, lastErrorCode: "PROC-404",
      lastErrorMessage: "Terminal process not found on monitored host.", riskLevel: "Offline", healthScore: 14, restartRequired: true, autoRestartEnabled: true, maintenanceMode: true, restartAttemptCount: 2,
      restartAttemptLimit: 3, highRiskTradeInProgress: false, accountSyncInProgress: false, lastMarketTickAt: ago(480), lastAccountUpdateAt: ago(492), logsUpdatedAt: ago(477), updatedAt: ago(480)
    }
  ];
  const heartbeatLogs: HeartbeatLog[] = terminals.flatMap((terminal, index) =>
    [0, 1, 2, 3, 4].map((sample) => ({
      id: `hb-${index}-${sample}`, terminalId: terminal.terminalId, heartbeatReceivedAt: ago(terminal.heartbeatDelaySeconds + sample * terminal.expectedHeartbeatIntervalSeconds),
      expectedIntervalSeconds: terminal.expectedHeartbeatIntervalSeconds,
      delaySeconds: Math.max(1, terminal.heartbeatDelaySeconds - sample * (terminal.riskLevel === "Healthy" ? 0 : 6)),
      status: terminal.heartbeatStatus, cpuUsagePercent: Math.max(0, terminal.cpuUsagePercent - sample * 2), memoryUsagePercent: Math.max(0, terminal.memoryUsagePercent - sample),
      diskUsagePercent: terminal.diskUsagePercent, networkLatencyMs: terminal.networkLatencyMs, processRunning: terminal.processStatus === "Running",
      brokerConnected: terminal.connectionStatus !== "Offline", marketDataActive: terminal.marketDataActive, tradingEnabled: terminal.tradingEnabled
    }))
  );
  const events: TerminalEvent[] = [
    { id: "te-1", terminalId: "term-fra-03", terminalName: "MT5-Prop-03", eventType: "Heartbeat missed", severity: "Critical", sourceModule: "Heartbeat Monitor", message: "12 heartbeats missed during authentication failure.", previousStatus: "Degraded", newStatus: "Critical", triggeredBy: "Autonomous monitor", actionTaken: "Trading held and recovery proposed", result: "Awaiting safe restart", autoResolved: false, createdAt: ago(186) },
    { id: "te-2", terminalId: "term-fra-03", terminalName: "MT5-Prop-03", eventType: "Broker login failure", severity: "Critical", sourceModule: "Session Manager", message: "Authentication rejected during reconnect workflow.", previousStatus: "Watch", newStatus: "Critical", triggeredBy: "Broker session", actionTaken: "Account blocked", result: "Trading disabled", autoResolved: false, createdAt: ago(265) },
    { id: "te-3", terminalId: "term-ny4-02", terminalName: "MT5-Failover-02", eventType: "Reconnect attempt", severity: "Warning", sourceModule: "Network Monitor", message: "Elevated connection latency triggered session validation.", previousStatus: "Healthy", newStatus: "Degraded", triggeredBy: "Autonomous monitor", actionTaken: "Connection tested", result: "Monitoring continued", autoResolved: false, createdAt: ago(420) },
    { id: "te-4", terminalId: "term-ld4-01", terminalName: "MT5-Live-01", eventType: "Trading restored", severity: "Info", sourceModule: "Recovery Engine", message: "Heartbeat and gateway validations passed.", previousStatus: "Watch", newStatus: "Healthy", triggeredBy: "AI auto-remediation", actionTaken: "Order route enabled", result: "Recovered", autoResolved: true, createdAt: ago(3700) },
    { id: "te-5", terminalId: "term-lon-04", terminalName: "MT5-Research-04", eventType: "Terminal shutdown", severity: "Warning", sourceModule: "Maintenance Manager", message: "Terminal placed in planned maintenance.", previousStatus: "Healthy", newStatus: "Offline", triggeredBy: "Infrastructure admin", actionTaken: "Trading disabled", result: "Maintenance active", autoResolved: true, createdAt: ago(480) }
  ];
  const errors: TerminalErrorLog[] = [
    { id: "err-1", terminalId: "term-fra-03", terminalName: "MT5-Prop-03", brokerName: "FTMO", accountLogin: "88731690", errorCode: "AUTH-401", errorMessage: "Broker login rejected after credential session expiry.", severity: "Critical", sourceModule: "Authentication", repeatCount: 4, lastSeenAt: ago(265), resolved: false, aiExplanation: "Repeated login rejection prevents heartbeat-backed synchronization.", suggestedFix: "Re-authenticate account after safe terminal restart." },
    { id: "err-2", terminalId: "term-fra-03", terminalName: "MT5-Prop-03", brokerName: "FTMO", accountLogin: "88731690", errorCode: "FEED-408", errorMessage: "NASDAQ feed stopped publishing ticks.", severity: "Critical", sourceModule: "Market Data", repeatCount: 12, lastSeenAt: ago(203), resolved: false, aiExplanation: "Feed interruption follows failed broker authentication.", suggestedFix: "Re-sync symbols after session recovery." },
    { id: "err-3", terminalId: "term-ny4-02", terminalName: "MT5-Failover-02", brokerName: "Pepperstone", accountLogin: "54290016", errorCode: "NET-201", errorMessage: "Latency exceeded 250 ms threshold.", severity: "Warning", sourceModule: "Broker", repeatCount: 3, lastSeenAt: ago(47), resolved: false, aiExplanation: "Network path degradation raises fill-time variance.", suggestedFix: "Continue monitoring and prefer primary route." },
    { id: "err-4", terminalId: "term-lon-04", terminalName: "MT5-Research-04", brokerName: "IC Markets", accountLogin: "73018511", errorCode: "PROC-404", errorMessage: "Process unavailable during planned maintenance.", severity: "Info", sourceModule: "Terminal", repeatCount: 1, lastSeenAt: ago(480), resolved: true, aiExplanation: "Intentional shutdown, not an unplanned failure.", suggestedFix: "Restore terminal after maintenance window." }
  ];
  const diagnostics: TerminalAiDiagnostic[] = [
    { id: "td-1", terminalId: "term-fra-03", terminalName: "MT5-Prop-03", riskScore: 94, failureProbability: 93, anomalyDetected: "Heartbeat delay and memory pressure detected", severity: "Critical", rootCause: "Memory usage reached 89% while heartbeat delay exceeded 180 seconds after login rejection.", businessImpact: "Terminal cannot safely stream prices or route orders.", recommendation: "Execute safe restart, re-authenticate, re-sync symbols, and keep trading blocked pending validation.", confidenceScore: 0.96, autoFixEligible: true, autoFixStatus: "Approval Required", estimatedRecoveryConfidence: 0.88, escalationRequired: true, createdAt: ago(180) },
    { id: "td-2", terminalId: "term-ny4-02", terminalName: "MT5-Failover-02", riskScore: 58, failureProbability: 54, anomalyDetected: "Broker session instability likely", severity: "Warning", rootCause: "Latency and memory are trending upward while heartbeats enter watch state.", businessImpact: "Fallback execution quality may degrade during a primary-route failover.", recommendation: "Hold failover capacity under monitoring and run a health check.", confidenceScore: 0.89, autoFixEligible: true, autoFixStatus: "Available", estimatedRecoveryConfidence: 0.92, escalationRequired: false, createdAt: ago(47) }
  ];
  return { terminals, heartbeatLogs, events, errors, diagnostics };
}

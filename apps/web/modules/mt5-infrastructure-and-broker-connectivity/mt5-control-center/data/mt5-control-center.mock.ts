import type {
  Account,
  AiDiagnostic,
  Broker,
  ConnectionEvent,
  ExecutionSample,
  SymbolMapping,
  Terminal,
  WorkflowNode
} from "../types/mt5-control-center.types";

const ago = (seconds: number) => new Date(Date.now() - seconds * 1000).toISOString();

export function createMt5Seed() {
  const brokers: Broker[] = [
    {
      id: "broker-icm", brokerName: "IC Markets", brokerCode: "ICM", mt5ServerName: "ICMarketsSC-Live23", serverRegion: "London", connectionMode: "MT5 Gateway", status: "Healthy",
      averageLatencyMs: 42, averageSpread: 0.2, executionQualityScore: 96, dataFeedQualityScore: 98, slippageRate: 0.7, requoteRate: 0.2, failedOrderRate: 0.1, uptimePercent: 99.98, loginHealth: "Healthy", lastIncident: null
    },
    {
      id: "broker-pepper", brokerName: "Pepperstone", brokerCode: "PEP", mt5ServerName: "Pepperstone-Edge04", serverRegion: "New York", connectionMode: "FIX / MT5 Bridge", status: "Warning",
      averageLatencyMs: 287, averageSpread: 0.5, executionQualityScore: 74, dataFeedQualityScore: 89, slippageRate: 5.2, requoteRate: 2.1, failedOrderRate: 1.4, uptimePercent: 98.62, loginHealth: "Healthy", lastIncident: "Latency degradation at LD4 cross-connect"
    },
    {
      id: "broker-ftmo", brokerName: "FTMO", brokerCode: "FTMO", mt5ServerName: "FTMO-Server3", serverRegion: "Frankfurt", connectionMode: "Terminal Session", status: "Critical",
      averageLatencyMs: 510, averageSpread: 1.4, executionQualityScore: 38, dataFeedQualityScore: 61, slippageRate: 13.4, requoteRate: 9.6, failedOrderRate: 12.5, uptimePercent: 91.22, loginHealth: "Critical", lastIncident: "Authentication rejected after terminal restart"
    }
  ];
  const terminals: Terminal[] = [
    { id: "term-ld4-01", terminalUuid: "mt5-ld4-0001", terminalName: "Execution Primary", brokerId: "broker-icm", brokerName: "IC Markets", serverName: "ICMarketsSC-Live23", accountLogin: "73018421", accountType: "Live", terminalVersion: "5.00 build 4770", hostMachine: "VPS-LD4-01", status: "Healthy", cpuUsage: 21, memoryUsage: 44, diskUsage: 36, latencyMs: 42, uptimeSeconds: 2_391_020, lastHeartbeatAt: ago(2), autoRestartEnabled: true, tradingEnabled: true },
    { id: "term-ny4-02", terminalUuid: "mt5-ny4-0002", terminalName: "Execution Failover", brokerId: "broker-pepper", brokerName: "Pepperstone", serverName: "Pepperstone-Edge04", accountLogin: "54290016", accountType: "Live", terminalVersion: "5.00 build 4770", hostMachine: "VPS-NY4-02", status: "Warning", cpuUsage: 57, memoryUsage: 71, diskUsage: 49, latencyMs: 287, uptimeSeconds: 604_921, lastHeartbeatAt: ago(10), autoRestartEnabled: true, tradingEnabled: true },
    { id: "term-fra-03", terminalUuid: "mt5-fra-0003", terminalName: "Prop Evaluation", brokerId: "broker-ftmo", brokerName: "FTMO", serverName: "FTMO-Server3", accountLogin: "88731690", accountType: "Prop Firm", terminalVersion: "5.00 build 4755", hostMachine: "VPS-FRA-03", status: "Critical", cpuUsage: 92, memoryUsage: 89, diskUsage: 77, latencyMs: 510, uptimeSeconds: 612, lastHeartbeatAt: ago(73), autoRestartEnabled: true, tradingEnabled: false }
  ];
  const accounts: Account[] = [
    { id: "acct-1", brokerId: "broker-icm", brokerName: "IC Markets", terminalId: "term-ld4-01", accountLogin: "73018421", accountType: "Live", currency: "USD", balance: 284_200, equity: 286_410, margin: 14_280, freeMargin: 272_130, leverage: "1:100", tradeAllowed: true, syncStatus: "Healthy", lastSyncAt: ago(8), status: "Healthy" },
    { id: "acct-2", brokerId: "broker-pepper", brokerName: "Pepperstone", terminalId: "term-ny4-02", accountLogin: "54290016", accountType: "Live", currency: "USD", balance: 162_750, equity: 161_930, margin: 9_320, freeMargin: 152_610, leverage: "1:200", tradeAllowed: true, syncStatus: "Warning", lastSyncAt: ago(37), status: "Warning" },
    { id: "acct-3", brokerId: "broker-ftmo", brokerName: "FTMO", terminalId: "term-fra-03", accountLogin: "88731690", accountType: "Prop Firm", currency: "USD", balance: 100_000, equity: 99_360, margin: 0, freeMargin: 99_360, leverage: "1:100", tradeAllowed: false, syncStatus: "Critical", lastSyncAt: ago(480), status: "Critical" }
  ];
  const symbols: SymbolMapping[] = [
    { id: "sym-1", brokerId: "broker-icm", symbol: "EURUSD", brokerSymbol: "EURUSD.raw", normalizedSymbol: "EURUSD", assetClass: "Forex Major", digits: 5, contractSize: 100000, tickValue: 1, spread: 0.2, normalSpread: 0.3, tradingAllowed: true, dataFeedActive: true, mappingStatus: "Healthy", lastTickAt: ago(1) },
    { id: "sym-2", brokerId: "broker-icm", symbol: "GBPUSD", brokerSymbol: "GBPUSDm", normalizedSymbol: "GBPUSD", assetClass: "Forex Major", digits: 5, contractSize: 100000, tickValue: 1, spread: 0.4, normalSpread: 0.4, tradingAllowed: true, dataFeedActive: true, mappingStatus: "Healthy", lastTickAt: ago(2) },
    { id: "sym-3", brokerId: "broker-pepper", symbol: "EURGBP", brokerSymbol: "EURGBP.pro", normalizedSymbol: "EURGBP", assetClass: "Forex Cross", digits: 5, contractSize: 100000, tickValue: 1, spread: 0.8, normalSpread: 0.5, tradingAllowed: true, dataFeedActive: true, mappingStatus: "Warning", lastTickAt: ago(18) },
    { id: "sym-4", brokerId: "broker-icm", symbol: "XAUUSD", brokerSymbol: "GOLD", normalizedSymbol: "XAUUSD", assetClass: "Metal", digits: 2, contractSize: 100, tickValue: 1, spread: 1.8, normalSpread: 1.4, tradingAllowed: true, dataFeedActive: true, mappingStatus: "Healthy", lastTickAt: ago(2) },
    { id: "sym-5", brokerId: "broker-ftmo", symbol: "NAS100", brokerSymbol: "NASDAQ_ecn", normalizedSymbol: "NAS100", assetClass: "Index", digits: 1, contractSize: 1, tickValue: 1, spread: 7.4, normalSpread: 2.1, tradingAllowed: false, dataFeedActive: false, mappingStatus: "Critical", lastTickAt: ago(91) },
    { id: "sym-6", brokerId: "broker-pepper", symbol: "SPX500", brokerSymbol: "SPX500.raw", normalizedSymbol: "SPX500", assetClass: "Index", digits: 1, contractSize: 1, tickValue: 1, spread: 1.1, normalSpread: 1, tradingAllowed: true, dataFeedActive: true, mappingStatus: "Healthy", lastTickAt: ago(3) },
    { id: "sym-7", brokerId: "broker-pepper", symbol: "US30", brokerSymbol: "US30m", normalizedSymbol: "US30", assetClass: "Index", digits: 1, contractSize: 1, tickValue: 1, spread: 2.2, normalSpread: 2, tradingAllowed: true, dataFeedActive: true, mappingStatus: "Healthy", lastTickAt: ago(4) }
  ];
  const executionSamples: ExecutionSample[] = [
    { id: "exec-1", brokerId: "broker-icm", accountId: "acct-1", symbol: "EURUSD", orderType: "Market Buy", requestedPrice: 1.0842, executedPrice: 1.08421, slippagePoints: 1, executionTimeMs: 48, requoteDetected: false, spreadAtExecution: 0.2, liquidityScore: 98, createdAt: ago(60) },
    { id: "exec-2", brokerId: "broker-icm", accountId: "acct-1", symbol: "XAUUSD", orderType: "Limit Sell", requestedPrice: 2354.2, executedPrice: 2354.22, slippagePoints: 2, executionTimeMs: 61, requoteDetected: false, spreadAtExecution: 1.8, liquidityScore: 94, createdAt: ago(110) },
    { id: "exec-3", brokerId: "broker-pepper", accountId: "acct-2", symbol: "EURGBP", orderType: "Market Buy", requestedPrice: 0.8551, executedPrice: 0.85517, slippagePoints: 7, executionTimeMs: 301, requoteDetected: true, spreadAtExecution: 0.8, liquidityScore: 65, createdAt: ago(145) },
    { id: "exec-4", brokerId: "broker-ftmo", accountId: "acct-3", symbol: "NAS100", orderType: "Market Buy", requestedPrice: 21882.4, slippagePoints: 0, executionTimeMs: 620, rejectionReason: "Trading disabled: authentication stale", requoteDetected: false, spreadAtExecution: 7.4, liquidityScore: 32, createdAt: ago(213) }
  ];
  const diagnostics: AiDiagnostic[] = [
    { id: "diag-1", issue: "High execution latency detected", affectedComponent: "Pepperstone / VPS-NY4-02", severity: "Warning", severityScore: 64, rootCauseAnalysis: "Latency increased from 78 ms to 287 ms over the last 15 minutes.", businessImpact: "Entries may incur slippage or miss desired liquidity.", recommendation: "Route new orders to IC Markets until the NY4 path normalizes.", autoRemediationAvailable: true, autoRemediationStatus: "Available", confidenceScore: 0.91, escalationRequired: false, createdAt: ago(180) },
    { id: "diag-2", issue: "Terminal authentication failure", affectedComponent: "FTMO / VPS-FRA-03", severity: "Critical", severityScore: 92, rootCauseAnalysis: "Terminal heartbeat expired following rejected account authentication.", businessImpact: "Prop account cannot receive data or execute validated orders.", recommendation: "Restart terminal, re-authenticate, re-sync symbols, and keep trading disabled until cleared.", autoRemediationAvailable: true, autoRemediationStatus: "Approval Required", confidenceScore: 0.96, escalationRequired: true, createdAt: ago(300) }
  ];
  const incidents: ConnectionEvent[] = [
    { id: "event-1", brokerId: "broker-ftmo", terminalId: "term-fra-03", accountId: "acct-3", eventType: "Failed login", severity: "Critical", statusBefore: "Warning", statusAfter: "Critical", message: "Authentication rejected for account 88731690", rootCause: "Stored session token expired", autoResolved: false, createdAt: ago(300) },
    { id: "event-2", brokerId: "broker-ftmo", terminalId: "term-fra-03", eventType: "Terminal restart", severity: "Warning", statusBefore: "Offline", statusAfter: "Critical", message: "Automated restart attempted; awaiting authentication", rootCause: "Recovery workflow stage 2", autoResolved: false, createdAt: ago(255) },
    { id: "event-3", brokerId: "broker-pepper", terminalId: "term-ny4-02", eventType: "Market feed interruption", severity: "Warning", statusBefore: "Healthy", statusAfter: "Warning", message: "Delayed EURGBP ticks detected", rootCause: "NY4 gateway latency spike", autoResolved: false, createdAt: ago(180) },
    { id: "event-4", brokerId: "broker-icm", terminalId: "term-ld4-01", eventType: "Successful recovery", severity: "Info", statusBefore: "Warning", statusAfter: "Healthy", message: "Broker session recovered without order impact", rootCause: "Transient network loss", autoResolved: true, resolvedAt: ago(3200), createdAt: ago(3300) }
  ];
  const workflow: WorkflowNode[] = [
    { id: "wf-broker", title: "Broker API / MT5 Terminal", status: "Warning", lastCheckedAt: ago(2), failureReason: "One terminal is critical", aiRecommendation: "Isolate FTMO routing" },
    { id: "wf-auth", title: "Account Authentication", status: "Critical", lastCheckedAt: ago(73), failureReason: "FTMO login rejected", aiRecommendation: "Re-authenticate account" },
    { id: "wf-symbol", title: "Symbol Sync", status: "Warning", lastCheckedAt: ago(18), failureReason: "NAS100 feed inactive", aiRecommendation: "Normalize and re-sync symbols" },
    { id: "wf-market", title: "Market Data Stream", status: "Warning", lastCheckedAt: ago(18), failureReason: "Delayed ticks present", aiRecommendation: "Fail over delayed feed" },
    { id: "wf-gateway", title: "Trade Execution Gateway", status: "Healthy", lastCheckedAt: ago(2), aiRecommendation: "Maintain primary route" },
    { id: "wf-risk", title: "Risk Validation", status: "Healthy", lastCheckedAt: ago(1), aiRecommendation: "Hold FTMO block" },
    { id: "wf-routing", title: "Order Routing", status: "Warning", lastCheckedAt: ago(2), failureReason: "Secondary route degraded", aiRecommendation: "Prefer LD4 gateway" },
    { id: "wf-feedback", title: "Execution Feedback", status: "Healthy", lastCheckedAt: ago(4), aiRecommendation: "Continue analysis" },
    { id: "wf-audit", title: "Audit Log", status: "Healthy", lastCheckedAt: ago(1), aiRecommendation: "No intervention required" }
  ];
  return { terminals, brokers, accounts, symbols, executionSamples, diagnostics, incidents, workflow };
}

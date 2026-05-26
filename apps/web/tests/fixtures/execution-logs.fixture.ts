import type { AuditRecord } from "@/modules/mt5-infrastructure-and-broker-connectivity/mt5-control-center/types/mt5-control-center.types";
import type {
  BrokerResponseRecord,
  ExecutionLog,
  ExecutionOrderType,
  ExecutionStatus,
  RiskLevel,
  RetryCancellationRecord
} from "@/modules/mt5-infrastructure-and-broker-connectivity/execution-logs/types/execution-logs.types";
import {
  buildDiagnostics,
  buildExceptions,
  buildWorkflow,
  classifyBrokerResponse,
  executionQualityScore,
  normalizeSymbol,
  riskFromLog,
  toQualityMetrics
} from "@/modules/mt5-infrastructure-and-broker-connectivity/execution-logs/algorithms/execution-logs.algorithms";

function isoNow(offsetMinutes = 0) {
  return new Date(Date.now() + offsetMinutes * 60_000).toISOString();
}

function stable(n: number) {
  const x = Math.sin(n * 971) * 10_000;
  return x - Math.floor(x);
}

function id(prefix: string, n: number) {
  return `${prefix}-${String(n).padStart(3, "0")}`;
}

const brokers = [
  { brokerId: "broker-icm", broker: "IC Markets", server: "ICM-LD4" },
  { brokerId: "broker-ftmo", broker: "FTMO", server: "FTMO-NY4" },
  { brokerId: "broker-pep", broker: "Pepperstone", server: "PEP-LD5" }
];

const symbols = ["EURUSD", "GBPUSD", "USDJPY", "XAUUSD", "NAS100", "US30"];
const strategies = ["S-101", "S-202", "S-303", "S-404"];
const engines = ["Signal Engine", "Risk Engine", "Router Engine"];

function statusSeed(n: number): ExecutionStatus {
  const s = stable(n);
  if (s > 0.985) return "Timed Out";
  if (s > 0.95) return "Missing Feedback";
  if (s > 0.88) return "Failed";
  if (s > 0.78) return "Rejected";
  if (s > 0.7) return "Requoted";
  if (s > 0.62) return "Cancelled";
  if (s > 0.4) return "Executed";
  return "Synced";
}

function orderTypeSeed(n: number): ExecutionOrderType {
  const s = stable(n * 7);
  if (s > 0.7) return "Market";
  if (s > 0.5) return "Limit";
  if (s > 0.3) return "Stop";
  return "Stop Limit";
}

function riskSeed(n: number): RiskLevel {
  const s = stable(n * 13);
  if (s > 0.92) return "Critical";
  if (s > 0.78) return "High";
  if (s > 0.55) return "Elevated";
  if (s > 0.35) return "Moderate";
  return "Low";
}

function responseTemplate(status: ExecutionStatus, n: number) {
  if (status === "Rejected") {
    const patterns = [
      { code: "NO_MONEY", msg: "Insufficient margin" },
      { code: "INVALID_VOLUME", msg: "Invalid volume" },
      { code: "INVALID_STOPS", msg: "Invalid stops" },
      { code: "MARKET_CLOSED", msg: "Market closed" },
      { code: "CONTEXT_BUSY", msg: "Trade context busy" }
    ];
    return patterns[n % patterns.length]!;
  }
  if (status === "Requoted") return { code: "REQUOTE", msg: "Requote: price changed" };
  if (status === "Timed Out") return { code: "TIMEOUT", msg: "Broker timeout" };
  if (status === "Missing Feedback") return { code: "NO_FEEDBACK", msg: "Missing MT5 feedback" };
  if (status === "Failed") return { code: "ROUTE_FAIL", msg: "Route failure: upstream timeout" };
  if (status === "Cancelled") return { code: "CANCELLED", msg: "Cancelled by risk gate" };
  return { code: "OK", msg: "Accepted" };
}

export function createExecutionLogsSeed() {
  const logs: ExecutionLog[] = [];
  const brokerResponses: BrokerResponseRecord[] = [];
  const retries: RetryCancellationRecord[] = [];
  const audit: AuditRecord[] = [];

  const now = Date.now();
  let n = 1;
  for (let i = 0; i < 160; i += 1) {
    const broker = brokers[i % brokers.length]!;
    const symbol = symbols[i % symbols.length]!;
    const normalizedSymbol = normalizeSymbol(symbol);
    const strategyId = strategies[i % strategies.length]!;
    const status = statusSeed(i + symbol.length);
    const orderType = orderTypeSeed(i + 3);
    const direction = i % 2 === 0 ? ("Buy" as const) : ("Sell" as const);
    const basePrice = symbol === "XAUUSD" ? 2350 : symbol === "USDJPY" ? 156.2 : symbol === "NAS100" ? 19720 : symbol === "US30" ? 40550 : 1.1;
    const slip = status === "Executed" || status === "Synced" ? Math.round((stable(i * 17) - 0.5) * 14) : null;
    const execMs =
      status === "Timed Out" || status === "Missing Feedback" ? null :
      status === "Failed" ? 2900 + Math.round(stable(i * 23) * 800) :
      450 + Math.round(stable(i * 19) * 1200);
    const ticket =
      status === "Executed" || status === "Synced" || status === "Partially Filled" ? String(700000 + i) :
      status === "Requoted" ? String(700000 + i) :
      null;

    const occurredAt = new Date(now - i * 4 * 60_000).toISOString();
    const createdAt = new Date(now - i * 4 * 60_000 - 20_000).toISOString();
    const updatedAt = isoNow(-i);
    const respTemplate = responseTemplate(status, i);

    const log: ExecutionLog = {
      id: id("log", n),
      logId: `LOG-${String(1200 + i)}`,
      occurredAt,
      executionId: `EXE-${String(20000 + i)}`,
      orderId: `ORD-${String(90000 + i)}`,
      signalId: i % 5 === 0 ? `SIG-${String(5000 + i)}` : null,
      strategyId,
      sourceEngine: engines[i % engines.length]!,
      accountId: `acct-${(i % 10) + 1}`,
      account: `A${(i % 10) + 1}-LIVE`,
      brokerId: broker.brokerId,
      broker: broker.broker,
      terminalId: `term-${(i % 7) + 1}`,
      terminal: `Terminal-${(i % 7) + 1}`,
      eaInstanceId: i % 3 === 0 ? `ea-${(i % 5) + 1}` : null,
      eaInstance: i % 3 === 0 ? `EA-${(i % 5) + 1}` : null,
      symbol,
      normalizedSymbol,
      brokerSymbol: `${symbol}.${(i % 3) + 1}`,
      direction,
      orderType,
      volume: symbol === "XAUUSD" ? 0.2 : 1.0,
      requestedPrice: basePrice,
      stopLoss: basePrice - (direction === "Buy" ? 0.002 : -0.002),
      takeProfit: basePrice + (direction === "Buy" ? 0.003 : -0.003),
      timeInForce: i % 4 === 0 ? "IOC" : i % 4 === 1 ? "FOK" : i % 4 === 2 ? "GTC" : "DAY",
      expiryTime: i % 4 === 3 ? isoNow(120) : null,
      mt5Ticket: ticket,
      executedPrice: ticket ? basePrice + (slip ?? 0) * 0.0001 : null,
      executedVolume: ticket ? (status === "Partially Filled" ? 0.5 : 1.0) : null,
      executionStatus: status,
      fillStatus: status === "Partially Filled" ? "Partially Filled" : ticket ? "Filled" : status === "Rejected" || status === "Cancelled" ? "Not Filled" : "Unknown",
      brokerResponseCode: respTemplate.code,
      brokerResponseMessage: respTemplate.msg,
      slippagePoints: slip,
      spreadAtExecution: status === "Executed" || status === "Synced" ? Math.round(8 + stable(i * 29) * 18) : null,
      executionTimeMs: execMs,
      retryCount: i % 11 === 0 ? 2 : i % 7 === 0 ? 1 : 0,
      riskLevel: riskSeed(i + 11),
      reviewedStatus: i % 9 === 0 ? "Reviewed" : "Unreviewed",
      reviewedBy: i % 9 === 0 ? "trading.ops" : null,
      reviewedAt: i % 9 === 0 ? isoNow(-i + 1) : null,
      createdAt,
      updatedAt
    };
    log.riskLevel = riskFromLog(log);
    logs.push(log);

    const brokerResponse: BrokerResponseRecord = {
      id: `br-${String(n).padStart(3, "0")}`,
      executionLogId: log.id,
      brokerId: log.brokerId,
      broker: log.broker,
      accountId: log.accountId,
      account: log.account,
      orderId: log.orderId,
      mt5Ticket: log.mt5Ticket,
      responseCode: respTemplate.code,
      responseMessage: respTemplate.msg,
      rejectionReason: null,
      requoteDetected: false,
      offQuotesDetected: false,
      marginRejectionDetected: false,
      invalidVolumeDetected: false,
      tradeContextBusyDetected: false,
      requiredFix: "Investigate broker response; validate route and retry policy.",
      aiExplanation: "Awaiting broker response classification.",
      createdAt: log.occurredAt
    };
    const classified = classifyBrokerResponse(brokerResponse);
    brokerResponse.rejectionReason = classified.rejectionReason;
    brokerResponse.requoteDetected = classified.flags.requote;
    brokerResponse.offQuotesDetected = classified.flags.offQuotes;
    brokerResponse.marginRejectionDetected = classified.flags.insufficientMargin;
    brokerResponse.invalidVolumeDetected = classified.flags.invalidVolume;
    brokerResponse.tradeContextBusyDetected = classified.flags.tradeContextBusy;
    brokerResponse.requiredFix = classified.requiredFix;
    brokerResponse.aiExplanation = classified.aiExplanation;
    brokerResponses.push(brokerResponse);

    if (log.retryCount > 0 || log.executionStatus === "Cancelled") {
      retries.push({
        id: `rc-${String(n).padStart(3, "0")}`,
        originalExecutionId: log.executionId,
        retryExecutionId: log.retryCount > 0 ? `EXE-${String(20000 + i)}-R${log.retryCount}` : null,
        orderId: log.orderId,
        retryCount: log.retryCount,
        retryReason: log.retryCount > 0 ? (log.executionStatus === "Requoted" ? "Requote detected" : log.executionStatus === "Rejected" ? "Broker rejection" : "Transient failure") : null,
        retryEligibility: log.retryCount > 0 ? "Eligible" : "Ineligible",
        safeRetryStatus: log.executionStatus === "Timed Out" || log.executionStatus === "Missing Feedback" ? "Unsafe" : "Safe",
        cancellationReason: log.executionStatus === "Cancelled" ? "Risk expired / unsafe route" : null,
        cancelledBy: log.executionStatus === "Cancelled" ? "risk.manager" : null,
        cancelledAt: log.executionStatus === "Cancelled" ? log.occurredAt : null,
        finalOutcome: log.executionStatus,
        createdAt: log.occurredAt
      });
    }

    n += 1;
  }

  const qualityMetrics = toQualityMetrics(logs, brokerResponses);
  const diagnostics = buildDiagnostics(logs, brokerResponses, retries);
  const exceptions = buildExceptions(logs, brokerResponses);
  const workflow = buildWorkflow(logs, diagnostics[0] ?? null);

  const qualityScore = executionQualityScore({
    successRate: logs.length ? logs.filter((l) => l.executionStatus === "Synced" || l.executionStatus === "Executed").length / logs.length : 1,
    averageExecutionTimeMs: Math.round(logs.reduce((sum, l) => sum + (l.executionTimeMs ?? 0), 0) / Math.max(1, logs.filter((l) => l.executionTimeMs != null).length)),
    averageSlippagePoints: Math.round(logs.reduce((sum, l) => sum + (l.slippagePoints ?? 0), 0) / Math.max(1, logs.filter((l) => l.slippagePoints != null).length)),
    rejectionRate: logs.length ? logs.filter((l) => l.executionStatus === "Rejected").length / logs.length : 0,
    requoteRate: logs.length ? logs.filter((l) => l.executionStatus === "Requoted").length / logs.length : 0,
    feedbackCompletenessRate: logs.length ? logs.filter((l) => l.executionStatus !== "Missing Feedback").length / logs.length : 1,
    retryRate: logs.length ? Math.min(1, logs.reduce((sum, l) => sum + l.retryCount, 0) / logs.length / 3) : 0,
    timeoutRate: logs.length ? logs.filter((l) => l.executionStatus === "Timed Out").length / logs.length : 0
  });

  audit.unshift({
    id: "audit-001",
    userId: "system",
    action: "SYNC_EXECUTIONS",
    module: "Execution Logs",
    entityId: "SYNC",
    oldValue: null,
    newValue: { syncedAt: isoNow(-10) },
    ipAddress: "system",
    userAgent: "autonomous-execution-logs",
    timestamp: isoNow(-10)
  });

  return {
    logs,
    brokerResponses,
    retries,
    qualityMetrics,
    exceptions,
    diagnostics,
    workflow,
    audit,
    qualityScore
  };
}

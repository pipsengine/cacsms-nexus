import { normalizeSymbol } from "@/modules/mt5-infrastructure-and-broker-connectivity/mt5-control-center/algorithms/mt5-control-center.algorithms";
import type {
  AiSlippageDiagnostic,
  BrokerSlippageComparisonRow,
  SlippageAlert,
  SlippageAssetClass,
  SlippageExecution,
  SlippageLogEntry,
  SlippageThreshold,
  SlippageTrendPoint,
  SlippageWorkflowNode
} from "@/modules/mt5-infrastructure-and-broker-connectivity/slippage-monitor/types/slippage-monitor.types";
import {
  breachStatusFromThreshold,
  buildBrokerComparison,
  calculateSlippagePoints,
  classifySlippage,
  pointsToPips,
  riskLevelFromScore,
  shouldBlockExecution
} from "@/modules/mt5-infrastructure-and-broker-connectivity/slippage-monitor/algorithms/slippage-monitor.algorithms";

function isoNow(offsetSeconds = 0) {
  return new Date(Date.now() + offsetSeconds * 1000).toISOString();
}

function id(prefix: string, n: number) {
  return `${prefix}-${String(n).padStart(3, "0")}`;
}

function stable(n: number) {
  const x = Math.sin(n * 997) * 10_000;
  return x - Math.floor(x);
}

function mapAssetClass(raw: string): SlippageAssetClass {
  if (raw === "Forex") return "Forex";
  if (raw === "Metals") return "Metals";
  if (raw === "Indices") return "Indices";
  if (raw === "Crypto") return "Crypto";
  return "Unknown";
}

export const symbolMeta: Record<string, { digits: number; pointSize: number; pointsPerPip: number; pipValue: number }> = {
  EURUSD: { digits: 5, pointSize: 0.00001, pointsPerPip: 10, pipValue: 10 },
  GBPUSD: { digits: 5, pointSize: 0.00001, pointsPerPip: 10, pipValue: 10 },
  USDJPY: { digits: 3, pointSize: 0.001, pointsPerPip: 10, pipValue: 10 },
  XAUUSD: { digits: 2, pointSize: 0.01, pointsPerPip: 10, pipValue: 1 },
  NAS100: { digits: 1, pointSize: 0.1, pointsPerPip: 10, pipValue: 1 },
  SPX500: { digits: 1, pointSize: 0.1, pointsPerPip: 10, pipValue: 1 },
  US30: { digits: 1, pointSize: 0.1, pointsPerPip: 10, pipValue: 1 }
};

export function createMockThresholds(): SlippageThreshold[] {
  const now = Date.now();
  const rows: SlippageThreshold[] = [];
  const add = (partial: Omit<SlippageThreshold, "id" | "createdAt" | "updatedAt">, n: number) => {
    rows.push({ id: id("thr", n), createdAt: new Date(now - n * 3600_000).toISOString(), updatedAt: isoNow(-(n * 27)), ...partial });
  };

  const defaults = [
    { normalizedSymbol: "EURUSD", assetClass: "Forex" as const, normal: 0.2, warn: 0.5, crit: 1.0, block: 1.3, retry: 0.9 },
    { normalizedSymbol: "GBPUSD", assetClass: "Forex" as const, normal: 0.25, warn: 0.6, crit: 1.2, block: 1.6, retry: 1.0 },
    { normalizedSymbol: "USDJPY", assetClass: "Forex" as const, normal: 0.22, warn: 0.55, crit: 1.1, block: 1.45, retry: 0.95 },
    { normalizedSymbol: "XAUUSD", assetClass: "Metals" as const, normal: 0.35, warn: 0.9, crit: 1.8, block: 2.4, retry: 1.7 },
    { normalizedSymbol: "NAS100", assetClass: "Indices" as const, normal: 0.4, warn: 1.0, crit: 2.0, block: 2.7, retry: 2.0 },
    { normalizedSymbol: "SPX500", assetClass: "Indices" as const, normal: 0.35, warn: 0.95, crit: 1.9, block: 2.6, retry: 1.9 },
    { normalizedSymbol: "US30", assetClass: "Indices" as const, normal: 0.5, warn: 1.2, crit: 2.4, block: 3.1, retry: 2.4 }
  ];

  let n = 1;
  for (const d of defaults) {
    add(
      {
        symbol: null,
        normalizedSymbol: d.normalizedSymbol,
        assetClass: d.assetClass,
        brokerId: null,
        broker: null,
        accountType: "All",
        strategyType: "All",
        tradingSession: "All",
        newsImpactLevel: "High",
        volatilityRegime: "Normal",
        normalLimitPips: d.normal,
        warningLimitPips: d.warn,
        criticalLimitPips: d.crit,
        executionBlockLimitPips: d.block,
        maxRetrySlippagePips: d.retry,
        newsMultiplier: 1.6,
        autoDisableEnabled: true
      },
      n
    );
    n += 1;
  }

  add(
    {
      symbol: null,
      normalizedSymbol: "XAUUSD",
      assetClass: "Metals",
      brokerId: "broker-ftmo",
      broker: "FTMO",
      accountType: "Challenge",
      strategyType: "Scalping",
      tradingSession: "NY",
      newsImpactLevel: "High",
      volatilityRegime: "Volatile",
      normalLimitPips: 0.45,
      warningLimitPips: 1.1,
      criticalLimitPips: 2.2,
      executionBlockLimitPips: 2.9,
      maxRetrySlippagePips: 2.2,
      newsMultiplier: 1.85,
      autoDisableEnabled: true
    },
    n
  );

  return rows;
}

function pickThreshold(thresholds: SlippageThreshold[], normalizedSymbol: string, brokerId: string) {
  const scoped = thresholds.find((t) => t.normalizedSymbol === normalizedSymbol && t.brokerId === brokerId);
  return scoped ?? thresholds.find((t) => t.normalizedSymbol === normalizedSymbol && t.brokerId == null) ?? thresholds[0]!;
}

export function createMockExecutions(thresholds: SlippageThreshold[]): SlippageExecution[] {
  const brokers = [
    { brokerId: "broker-icm", broker: "IC Markets", accountId: "acct-icm-raw", account: "ICM Live - Raw" },
    { brokerId: "broker-ftmo", broker: "FTMO", accountId: "acct-ftmo-ch", account: "FTMO Challenge - Demo" },
    { brokerId: "broker-pep", broker: "Pepperstone", accountId: "acct-pep-demo", account: "Pepper Demo" }
  ];
  const symbols = ["EURUSD", "GBPUSD", "USDJPY", "XAUUSD", "NAS100", "SPX500", "US30"];
  const strategies = ["Mean Reversion", "Breakout", "Scalping", "Trend"];
  const sessions = ["Asia", "London", "NY"];

  const rows: SlippageExecution[] = [];
  let n = 1;
  for (let i = 0; i < 120; i += 1) {
    const broker = brokers[i % brokers.length]!;
    const symbol = symbols[i % symbols.length]!;
    const norm = normalizeSymbol(symbol);
    const meta = symbolMeta[norm.normalizedSymbol] ?? { digits: 5, pointSize: 0.00001, pointsPerPip: 10, pipValue: 10 };
    const threshold = pickThreshold(thresholds, norm.normalizedSymbol, broker.brokerId);

    const s = stable(i + symbol.length);
    const direction = s > 0.5 ? "Buy" : "Sell";
    const orderType = s > 0.78 ? "Market" : s > 0.6 ? "Limit" : "Stop";
    const strategy = strategies[i % strategies.length]!;
    const session = sessions[i % sessions.length]!;
    const news = s > 0.92;
    const volatility = clamp(35 + (s * 70), 0, 100);

    const base =
      norm.normalizedSymbol === "EURUSD"
        ? 1.086
        : norm.normalizedSymbol === "GBPUSD"
          ? 1.268
          : norm.normalizedSymbol === "USDJPY"
            ? 156.1
            : norm.normalizedSymbol === "XAUUSD"
              ? 2340.3
              : norm.normalizedSymbol === "NAS100"
                ? 18620
                : norm.normalizedSymbol === "SPX500"
                  ? 5272
                  : 39220;

    const noise = (s - 0.5) * (norm.assetClass === "Indices" ? 12 : norm.normalizedSymbol === "XAUUSD" ? 2.2 : norm.normalizedSymbol === "USDJPY" ? 0.04 : 0.002);
    const requestedPrice = Number((base + noise).toFixed(meta.digits));

    const bias = broker.brokerId === "broker-ftmo" ? 1.35 : broker.brokerId === "broker-pep" ? 1.1 : 1.0;
    const slipPipsAbsBase = (threshold.normalLimitPips + (news ? threshold.warningLimitPips * 0.8 : 0) + (volatility > 75 ? 0.6 : 0) + (s > 0.88 ? threshold.criticalLimitPips * 0.75 : 0)) * bias;
    const sign = s > 0.66 ? -1 : s > 0.33 ? 1 : 0;
    const slippagePips = Number((sign * slipPipsAbsBase * (0.6 + s)).toFixed(2));
    const slippagePoints = calculateSlippagePoints({
      direction,
      requestedPrice,
      executedPrice: requestedPrice + (direction === "Buy" ? 1 : -1) * slippagePips * (meta.pointSize * meta.pointsPerPip),
      pointSize: meta.pointSize
    });
    const slippagePipsComputed = pointsToPips(slippagePoints, meta.pointsPerPip);

    const executedPrice =
      direction === "Buy" ? Number((requestedPrice + slippagePipsComputed * meta.pointSize * meta.pointsPerPip).toFixed(meta.digits)) : Number((requestedPrice - slippagePipsComputed * meta.pointSize * meta.pointsPerPip).toFixed(meta.digits));

    const absPips = Math.abs(slippagePipsComputed);
    const breach = breachStatusFromThreshold(absPips, threshold, news);
    const execTime = Math.round(120 + s * 1100 + (news ? 200 : 0));
    const spreadAtExecution = Number((0.6 + (s * 6) * (norm.assetClass === "Indices" ? 0.5 : norm.normalizedSymbol === "XAUUSD" ? 0.8 : 0.3)).toFixed(2));

    const qualityScore = clamp(100 - absPips * 22 - execTime / 18 - spreadAtExecution * 4 - (broker.brokerId === "broker-ftmo" ? 6 : 0), 0, 100);
    const executionQuality = qualityScore >= 86 ? "Excellent" : qualityScore >= 72 ? "Good" : qualityScore >= 55 ? "Degraded" : "Poor";

    const riskScore = clamp(100 - qualityScore + (breach === "Blocked" ? 25 : breach === "Critical" ? 18 : breach === "Warning" ? 9 : 0), 0, 100);
    const riskLevel = riskLevelFromScore(100 - riskScore);

    const decision = shouldBlockExecution({
      breachStatus: breach,
      newsWindowActive: news,
      volatilityScore: volatility,
      executionTimeMs: execTime,
      spreadAtExecution,
      peerBrokerMateriallyBetter: broker.brokerId === "broker-ftmo" && absPips > threshold.warningLimitPips,
      threshold
    });

    const executionAllowed = !(decision.shouldBlock && threshold.autoDisableEnabled);

    const slipValue = Number((slippagePipsComputed * meta.pipValue).toFixed(2));
    const dirAdjusted = classifySlippage(slippagePipsComputed) === "Negative" ? -Math.abs(slippagePipsComputed) : Math.abs(slippagePipsComputed);

    rows.push({
      id: `exec-${n}`,
      executionId: id("execution", n),
      orderId: id("order", 900 + n),
      tradeId: s > 0.3 ? id("trade", 400 + n) : null,
      mt5Ticket: s > 0.2 ? String(120000 + n) : null,
      accountId: broker.accountId,
      account: broker.account,
      brokerId: broker.brokerId,
      broker: broker.broker,
      terminalId: "term-01",
      terminal: "MT5-Terminal-1",
      eaInstanceId: "ea-01",
      eaInstance: "EA-Instance-A",
      strategyId: id("strat", (i % 4) + 1),
      strategy,
      symbol,
      normalizedSymbol: norm.normalizedSymbol,
      assetClass: mapAssetClass(norm.assetClass),
      direction,
      orderType,
      requestedPrice,
      executedPrice,
      slippagePoints,
      slippagePips: slippagePipsComputed,
      slippageValue: slipValue,
      directionAdjustedSlippage: dirAdjusted,
      executionTimeMs: execTime,
      spreadAtExecution,
      marketVolatilityScore: Number(volatility.toFixed(1)),
      tradingSession: session,
      newsWindowActive: news,
      thresholdId: threshold.id,
      thresholdValue: threshold.warningLimitPips,
      breachStatus: breach,
      executionQualityScore: Math.round(qualityScore),
      executionQuality,
      riskLevel,
      executionAllowed,
      createdAt: isoNow(-(60 + i * 12))
    });
    n += 1;
  }
  return rows;
}

export function createMockTrends(executions: SlippageExecution[]): SlippageTrendPoint[] {
  const points: SlippageTrendPoint[] = [];
  for (let i = 0; i < Math.min(260, executions.length); i += 1) {
    const e = executions[i]!;
    points.push({
      measuredAt: isoNow(-(i * 30)),
      brokerId: e.brokerId,
      broker: e.broker,
      normalizedSymbol: e.normalizedSymbol,
      strategy: e.strategy,
      tradingSession: e.tradingSession,
      slippagePips: e.slippagePips,
      executionTimeMs: e.executionTimeMs,
      spreadAtExecution: e.spreadAtExecution
    });
  }
  return points;
}

export function createMockAlerts(executions: SlippageExecution[]): SlippageAlert[] {
  const base: SlippageAlert[] = [];
  const flagged = executions.filter((e) => e.breachStatus !== "Normal" || !e.executionAllowed).slice(0, 18);
  for (let i = 0; i < flagged.length; i += 1) {
    const e = flagged[i]!;
    base.push({
      id: `alert-${i + 1}`,
      timestamp: isoNow(-(420 + i * 33)),
      executionId: e.executionId,
      orderId: e.orderId,
      brokerId: e.brokerId,
      broker: e.broker,
      symbol: e.symbol,
      normalizedSymbol: e.normalizedSymbol,
      requestedPrice: e.requestedPrice,
      executedPrice: e.executedPrice,
      slippagePips: e.slippagePips,
      thresholdValuePips: e.thresholdValue,
      alertType: e.breachStatus === "Blocked" ? "Execution Blocked" : e.newsWindowActive ? "News Driven" : e.brokerId === "broker-ftmo" ? "Broker Issue" : "Warning",
      severity: e.breachStatus === "Critical" || e.breachStatus === "Blocked" ? "Critical" : "Warning",
      executionBlocked: !e.executionAllowed,
      rootCause: e.newsWindowActive ? "News-driven execution cost expansion." : "Broker/symbol execution quality deterioration.",
      aiExplanation: "Slippage degrades expected cost and can invalidate strategy edge; block when execution becomes unsafe.",
      resolutionStatus: i % 6 === 0 ? "Resolved" : "Unresolved",
      resolvedAt: i % 6 === 0 ? isoNow(-(120 + i * 9)) : null
    });
  }
  return base;
}

export function createMockLogs(executions: SlippageExecution[]): SlippageLogEntry[] {
  const logs: SlippageLogEntry[] = [];
  for (let i = 0; i < 28; i += 1) {
    const e = executions[i % executions.length]!;
    logs.push({
      id: `log-${i + 1}`,
      timestamp: isoNow(-(220 + i * 19)),
      eventType: i % 7 === 0 ? "Execution Block" : i % 3 === 0 ? "Threshold Check" : "Execution Feedback",
      severity: i % 7 === 0 ? "Critical" : i % 4 === 0 ? "Warning" : "Info",
      executionId: e.executionId,
      orderId: e.orderId,
      brokerId: e.brokerId,
      symbol: e.normalizedSymbol,
      message: i % 7 === 0 ? "Execution blocked due to slippage limits." : "Execution evaluated for slippage and quality.",
      statusBefore: "ΓÇö",
      statusAfter: e.executionAllowed ? "Allowed" : "Blocked",
      slippagePips: e.slippagePips,
      executionAllowed: e.executionAllowed,
      actionTaken: i % 7 === 0 ? "Block" : "Monitor"
    });
  }
  return logs;
}

export function createMockWorkflow(executions: SlippageExecution[], alerts: SlippageAlert[]): SlippageWorkflowNode[] {
  const total = executions.length;
  const breaches = alerts.filter((a) => a.severity !== "Info" && a.resolutionStatus !== "Resolved").length;
  const blocked = executions.filter((e) => !e.executionAllowed).length;
  const latest = alerts[0];
  const latestBreach = latest ? `${latest.alertType} ┬╖ ${latest.normalizedSymbol}` : "ΓÇö";
  const step = (title: string, status: "Healthy" | "Watch" | "Degraded" | "Critical", failedCount: number, delay: number, ai: string) => ({
    title,
    status,
    orderCount: total,
    failedCount,
    averageDelayMs: delay,
    latestBreach,
    aiRecommendation: ai
  });
  return [
    step("Order Requested", "Healthy", 0, 22, "Ensure order request timestamps are accurate for latency correlation."),
    step("Price Captured", "Healthy", 0, 18, "Validate requested price capture and spread at request time."),
    step("MT5 Execution", blocked > 0 ? "Degraded" : "Healthy", blocked, 210, "Monitor MT5 execution feedback for latency spikes."),
    step("Executed Price Returned", "Healthy", 0, 165, "Compare across brokers when executed price drift appears."),
    step("Slippage Calculated", breaches > 0 ? "Watch" : "Healthy", breaches, 35, "Classify positive/negative slippage by direction."),
    step("Threshold Checked", breaches > 0 ? "Degraded" : "Healthy", breaches, 44, "Apply news multiplier and per-strategy limits."),
    step("Broker Compared", "Healthy", 0, 70, "Prefer brokers with better execution quality rank."),
    step("Risk Scored", breaches > 0 ? "Watch" : "Healthy", breaches, 55, "Escalate when negative slippage clusters on broker or session."),
    step("Unsafe Execution Blocked", blocked > 0 ? "Critical" : "Healthy", blocked, 20, "Keep blocked until quality normalizes below warning thresholds."),
    step("Audit Logged", "Healthy", 0, 10, "Ensure blocks and threshold changes are audit logged.")
  ];
}

export function createMockAiDiagnostics(executions: SlippageExecution[]): AiSlippageDiagnostic[] {
  const top = executions
    .filter((e) => e.breachStatus !== "Normal" || !e.executionAllowed || e.executionQualityScore < 60)
    .slice(0, 18);
  return top.map((e, idx) => ({
    id: `ai-${idx + 1}-${e.executionId}`,
    issue: !e.executionAllowed ? "Unsafe execution blocked" : e.slippagePips < -0.05 ? "Abnormal negative slippage" : "Execution quality deterioration",
    affected: `${e.executionId} ┬╖ ${e.normalizedSymbol} ┬╖ ${e.broker}`,
    severity: !e.executionAllowed || e.breachStatus === "Critical" || e.breachStatus === "Blocked" ? "Critical" : "Warning",
    rootCause: e.newsWindowActive ? "News-driven slippage expansion." : e.executionTimeMs > 850 ? "Latency-driven slippage." : "Broker execution drift.",
    tradingImpact: "Slippage increases execution cost and can flip expected trade expectancy.",
    recommendedAction: !e.executionAllowed ? "Keep blocked and route to alternate broker if available." : "Compare peers and reduce exposure.",
    autoBlockRecommendation: e.breachStatus === "Critical" || e.breachStatus === "Blocked" || e.executionQualityScore < 55,
    confidenceScore: Math.min(96, Math.max(55, Math.round(100 - e.executionQualityScore)))
  }));
}

export function createSlippageMonitorSeed(): {
  thresholds: SlippageThreshold[];
  executions: SlippageExecution[];
  trends: SlippageTrendPoint[];
  alerts: SlippageAlert[];
  logs: SlippageLogEntry[];
  workflow: SlippageWorkflowNode[];
  brokerComparison: BrokerSlippageComparisonRow[];
  aiDiagnostics: AiSlippageDiagnostic[];
} {
  const thresholds = createMockThresholds();
  const executions = createMockExecutions(thresholds);
  const trends = createMockTrends(executions);
  const alerts = createMockAlerts(executions);
  const logs = createMockLogs(executions);
  const workflow = createMockWorkflow(executions, alerts);
  const brokerComparison = buildBrokerComparison(executions);
  const aiDiagnostics = createMockAiDiagnostics(executions);
  return { thresholds, executions, trends, alerts, logs, workflow, brokerComparison, aiDiagnostics };
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
